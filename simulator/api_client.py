"""Klien HTTP ke backend LoraField. Simulator memakai endpoint yang sama dengan firmware."""

from __future__ import annotations

import httpx


class ApiError(RuntimeError):
    pass


def _detail(response: httpx.Response) -> str:
    try:
        return str(response.json().get("detail", response.text))
    except ValueError:
        return response.text


class LoraFieldClient:
    def __init__(self, base_url: str, email: str, password: str, timeout_seconds: float) -> None:
        self._http = httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout_seconds)
        self._email = email
        self._password = password
        self._token: str | None = None

    def close(self) -> None:
        self._http.close()

    def login(self) -> None:
        response = self._http.post(
            "/api/auth/login", json={"email": self._email, "password": self._password}
        )
        if response.status_code != 200:
            raise ApiError(f"Login gagal ({response.status_code}): {_detail(response)}")
        self._token = response.json()["access_token"]

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        if self._token is None:
            self.login()
        response = self._http.request(method, path, headers=self._auth_header(), **kwargs)
        if response.status_code == 401:
            # Token habis masa berlakunya (JWT_EXPIRE_MINUTES) saat simulator berjalan lama.
            self.login()
            response = self._http.request(method, path, headers=self._auth_header(), **kwargs)
        return response

    def _auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._token}"}

    def _expect(self, response: httpx.Response, *statuses: int) -> dict:
        if response.status_code not in statuses:
            raise ApiError(
                f"{response.request.method} {response.request.url.path} "
                f"({response.status_code}): {_detail(response)}"
            )
        return response.json() if response.content else {}

    def get_farm(self, farm_id: str) -> dict | None:
        response = self._request("GET", f"/api/farms/{farm_id}")
        if response.status_code == 404:
            return None
        return self._expect(response, 200)["farm"]

    def create_farm(self, payload: dict) -> dict:
        return self._expect(self._request("POST", "/api/farms", json=payload), 201)

    def delete_farm(self, farm_id: str) -> bool:
        response = self._request("DELETE", f"/api/farms/{farm_id}")
        if response.status_code == 404:
            return False
        self._expect(response, 200)
        return True

    def register_nodes(self, gateway_device_id: str, farm_id: str, nodes: list[dict]) -> dict:
        response = self._request(
            "POST",
            f"/api/gateways/{gateway_device_id}/register",
            json={"farm_id": farm_id, "nodes": nodes},
        )
        return self._expect(response, 200)

    def post_reading(self, node_id: str, adm4: str, payload: dict) -> dict:
        response = self._request(
            "POST", f"/api/nodes/{node_id}/readings", params={"adm4": adm4}, json=payload
        )
        return self._expect(response, 201)

    def get_farm_weather(self, farm_id: str) -> dict | None:
        """Cuaca BMKG kebun. None kalau BMKG atau kode wilayahnya sedang tidak tersedia."""
        response = self._request("GET", f"/api/farms/{farm_id}/weather")
        if response.status_code != 200:
            return None
        return response.json()

    def post_gateway_log(self, farm_id: str, event: str, detail: str) -> None:
        response = self._request(
            "POST", f"/api/farms/{farm_id}/gateway-logs", json={"event": event, "detail": detail}
        )
        self._expect(response, 201)
