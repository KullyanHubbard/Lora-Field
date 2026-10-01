"""Alat bantu produksi gateway LoraField: isi pengaturan per alat lewat kabel USB.

Mengisi alamat server MQTT, port, password MQTT, dan password hotspot portal WiFi ke memori gateway,
lalu mencetak isi stiker (ID gateway, nama dan password hotspot, isi QR code WiFi). Password MQTT diketik
tersembunyi dan tidak pernah dicetak. Password hotspot dibuat acak kalau --ap-pass tidak diisi.

Jalankan dari folder firmware/ memakai Python bawaan PlatformIO (sudah berisi pyserial):

    %USERPROFILE%\\.platformio\\penv\\Scripts\\python.exe tools\\provision.py --port COM3 --mqtt-host 192.168.1.4

Gateway harus sudah berisi firmware gateway versi 0.2.0 atau lebih baru. WiFi tidak diisi di sini:
pembeli mengisinya sendiri lewat portal di HP.
"""

from __future__ import annotations

import argparse
import getpass
import re
import secrets
import socket
import struct
import sys
import time

import serial

BANNER = re.compile(r"LoraField gateway (GW-[0-9A-F]{12}), firmware (\S+)")
# Tanpa huruf dan angka yang mudah tertukar saat dibaca dari stiker (l/1, o/0, i).
AP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
AP_PASS_LENGTH = 12


def valid_secret(value: str, low: int, high: int) -> bool:
    """Sama dengan aturan firmware (parseSetCommand): ASCII terlihat, tanpa spasi."""
    return low <= len(value) <= high and all(0x21 <= ord(c) <= 0x7E for c in value)


def wifi_qr_text(ssid: str, password: str) -> str:
    """Isi QR code WiFi standar; HP yang memindainya langsung tersambung ke hotspot."""

    def escape(text: str) -> str:
        return re.sub(r'([\\;,:"])', r"\\\1", text)

    return f"WIFI:T:WPA;S:{escape(ssid)};P:{escape(password)};;"


def mqtt_login(host: str, port: int, username: str, password: str) -> tuple[bool, str]:
    """Coba login MQTT 3.1.1 ke broker, lalu putus lagi. Client ID berbeda supaya sesi gateway yang sedang
    tersambung tidak tertendang. Hasil: (diterima, keterangan)."""

    def field(text: str) -> bytes:
        data = text.encode("utf-8")
        return struct.pack("!H", len(data)) + data

    body = field("MQTT") + bytes([4, 0xC2]) + struct.pack("!H", 30)  # level 4, username+password+clean
    body += field(f"{username}-cek") + field(username) + field(password)
    length = bytearray()
    remaining = len(body)
    while True:
        byte, remaining = remaining % 128, remaining // 128
        length.append(byte | (0x80 if remaining else 0))
        if not remaining:
            break
    try:
        with socket.create_connection((host, port), timeout=5) as sock:
            sock.sendall(bytes([0x10]) + bytes(length) + body)
            reply = sock.recv(4)
            sock.sendall(b"\xe0\x00")  # DISCONNECT: broker tidak mengirim Last Will
    except OSError as exc:
        return False, f"broker tidak bisa dihubungi ({exc})"
    if len(reply) < 4 or reply[0] != 0x20:
        return False, "balasan broker tidak dikenal"
    # Mosquitto membalas password salah dengan kode 5 (tidak diizinkan), bukan 4.
    reasons = {0: "diterima", 4: "salah", 5: "ditolak (password salah atau gateway belum terdaftar di broker)"}
    return reply[3] == 0, reasons.get(reply[3], f"ditolak (kode {reply[3]})")


def open_port(port: str) -> serial.Serial:
    ser = serial.Serial()
    ser.port = port
    ser.baudrate = 115200
    ser.timeout = 0.2
    ser.dtr = False  # DTR dan RTS dilepas supaya membuka port tidak membuat board masuk mode upload
    ser.rts = False
    ser.open()
    return ser


def read_line(ser: serial.Serial) -> str:
    return ser.readline().decode("utf-8", "replace").strip()


def enter_config_mode(ser: serial.Serial) -> tuple[str, str]:
    """Restart gateway lewat RTS (terhubung ke EN), lalu kirim "config" dalam jeda setelah menyala."""
    ser.rts = True
    time.sleep(0.2)
    ser.rts = False
    deadline = time.time() + 15
    while time.time() < deadline:
        match = BANNER.search(read_line(ser))
        if match is None:
            continue
        ser.write(b"config\n")
        wait_until = time.time() + 6
        while time.time() < wait_until:
            line = read_line(ser)
            if line.startswith("MODE PENGATURAN") or line == "OK config":
                return match.group(1), match.group(2)
        break
    sys.exit("Gateway tidak masuk mode pengaturan. Cek port, kabel USB, dan firmware gateway (minimal 0.2.0).")


def send(ser: serial.Serial, command: str) -> str:
    """Kirim satu perintah, kembalikan balasan OK/ERROR. Baris lain (pengingat) dilewati."""
    ser.write(command.encode("ascii") + b"\n")
    deadline = time.time() + 5
    while time.time() < deadline:
        line = read_line(ser)
        if line.startswith("OK") or line.startswith("ERROR"):
            return line
    return "ERROR gateway tidak menjawab"


def main() -> None:
    parser = argparse.ArgumentParser(description="Isi pengaturan gateway LoraField lewat USB.")
    parser.add_argument("--port", required=True, help="Port Serial gateway, mis. COM3")
    parser.add_argument("--mqtt-host", required=True, help="Alamat broker MQTT (IP atau domain)")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="Port broker MQTT (bawaan 1883)")
    parser.add_argument("--ap-pass", help="Password hotspot portal; kosong = dibuat acak")
    parser.add_argument("--portal", action="store_true", help="Setelah selesai, langsung buka portal WiFi")
    parser.add_argument(
        "--forget-wifi", action="store_true", help="Hapus WiFi tersimpan (mis. sisa uji); portal terbuka sendiri"
    )
    parser.add_argument(
        "--skip-mqtt-check", action="store_true", help="Lewati cek password MQTT ke broker (broker tidak terjangkau)"
    )
    args = parser.parse_args()

    mqtt_pass = getpass.getpass("Password MQTT gateway ini (tidak tampil saat diketik): ")
    if getpass.getpass("Ketik ulang password MQTT: ") != mqtt_pass:
        sys.exit("Password MQTT tidak sama.")
    if not valid_secret(mqtt_pass, 8, 64):
        sys.exit("Password MQTT harus 8-64 karakter, tanpa spasi.")
    ap_pass = args.ap_pass or "".join(secrets.choice(AP_ALPHABET) for _ in range(AP_PASS_LENGTH))
    if not valid_secret(ap_pass, 8, 63):
        sys.exit("Password hotspot harus 8-63 karakter, tanpa spasi.")

    with open_port(args.port) as ser:
        gateway_id, firmware = enter_config_mode(ser)
        print(f"Gateway {gateway_id}, firmware {firmware}: mode pengaturan")
        # Password yang salah ketik baru ketahuan saat gateway ditolak broker, jadi dicek dulu di sini.
        if not args.skip_mqtt_check:
            accepted, reason = mqtt_login(args.mqtt_host, args.mqtt_port, gateway_id, mqtt_pass)
            if not accepted:
                send(ser, "restart")
                sys.exit(f"Password MQTT {reason} menurut broker {args.mqtt_host}. Pengaturan gateway tidak diubah.")
            print("  password MQTT: diterima broker")
        for key, value in (
            ("mqtt_host", args.mqtt_host),
            ("mqtt_port", str(args.mqtt_port)),
            ("mqtt_pass", mqtt_pass),
            ("ap_pass", ap_pass),
        ):
            reply = send(ser, f"set {key} {value}")
            if not reply.startswith("OK"):
                sys.exit(f"Gagal mengisi {key}: {reply}")
            print(f"  {key}: tersimpan")
        if args.forget_wifi:
            send(ser, "forget wifi")
        elif args.portal:
            send(ser, "portal")
        else:
            send(ser, "restart")

    ssid = f"LoraField-{gateway_id[-4:]}"
    print()
    print("Isi stiker gateway:")
    print(f"  ID gateway       : {gateway_id}")
    print(f"  Hotspot WiFi     : {ssid}")
    print(f"  Password hotspot : {ap_pass}")
    print(f"  Isi QR code      : {wifi_qr_text(ssid, ap_pass)}")
    print()
    print(f"Password MQTT yang sama harus terdaftar di broker dengan username {gateway_id}.")
    if args.forget_wifi or args.portal:
        print(f"Portal WiFi dibuka: sambungkan HP ke {ssid} dalam beberapa detik.")


if __name__ == "__main__":
    main()
