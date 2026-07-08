import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "motion/react"
import {
  Activity,
  ArrowRight,
  ChevronRight,
  CloudSun,
  Droplets,
  History,
  MapPin,
  Menu,
  Sprout,
  Star,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DASHBOARD_PREVIEW_IMAGE_URL } from "./constants"
import "./LandingPage.css"

// Lebar konten + padding horizontal yang konsisten. Tailwind v4 di proyek ini
// tidak mengonfigurasi utility `container` (center/padding), jadi pakai kelas
// eksplisit ini sebagai gantinya.
const SHELL = "mx-auto w-full max-w-7xl px-4 md:px-6"

// Grid garis dekoratif. Warna garis pakai token tema --grid-line (scoped di
// LandingPage.css), bukan hex hardcoded. Referensi var() bebas koma — penting karena
// fungsi ber-koma (mis. color-mix) di dalam arbitrary value memutus parser Tailwind
// sehingga utiliti background-image gagal ter-generate. --border (10% putih) terlalu
// redup; --grid-line (16% putih di dark) tampak halus tapi jelas di atas bg gelap.
const GRID =
  "bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:4rem_4rem]"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

const features = [
  {
    title: "Monitoring Sensor Real-Time",
    description: "Pantau kelembaban tanah, suhu, dan kelembaban udara dari setiap node sensor secara langsung.",
    icon: <Activity className="size-5" />,
  },
  {
    title: "Irigasi Otomatis Cerdas",
    description: "Katup irigasi buka/tutup otomatis berdasarkan kondisi tanah dan prediksi cuaca.",
    icon: <Droplets className="size-5" />,
  },
  {
    title: "Prediksi Cuaca BMKG",
    description: "Data cuaca akurat per lokasi kebun, diperbarui setiap 30 menit.",
    icon: <CloudSun className="size-5" />,
  },
  {
    title: "Kelola Banyak Kebun",
    description: "Satu akun untuk banyak kebun. Tiap kebun punya komoditas dan aturan irigasi sendiri.",
    icon: <Sprout className="size-5" />,
  },
  {
    title: "Peta Kebun Interaktif",
    description: "Lihat lokasi dan status seluruh kebunmu dalam satu peta.",
    icon: <MapPin className="size-5" />,
  },
  {
    title: "Riwayat & Export Data",
    description: "Log keputusan irigasi tersimpan rapi, siap diekspor ke CSV.",
    icon: <History className="size-5" />,
  },
]

const steps = [
  {
    step: "01",
    title: "Pasang Perangkat",
    description: "Pasang node sensor dan gateway di kebun. Perangkat akan otomatis tersambung dan mulai mengirim data.",
  },
  {
    step: "02",
    title: "Tambah Kebun & Aturan",
    description: "Daftarkan kebunmu di dashboard, pilih jenis tanaman, dan tentukan aturan irigasi sesuai kebutuhan.",
  },
  {
    step: "03",
    title: "Pantau & Serahkan ke Sistem",
    description: "Lihat data real-time dari dashboard. Katup irigasi akan bekerja otomatis berdasarkan tanah dan cuaca.",
  },
]

const testimonials = [
  {
    quote:
      "Sejak pakai LoraField, saya nggak perlu bolak-balik cek sawah lagi. Katup irigasi buka sendiri saat tanah kering, hasil panen malah naik 20%.",
    author: "Budi Santoso",
    role: "Petani Padi, Jawa Barat",
    rating: 5,
  },
  {
    quote:
      "Dulu sering kebanjiran atau kekeringan gara-gara lupa nutup air. Sekarang sistem yang atur, cabai saya jadi lebih sehat dan pertumbuhannya merata.",
    author: "Siti Aminah",
    role: "Petani Cabai, Jawa Tengah",
    rating: 5,
  },
  {
    quote:
      "Kami kelola banyak kebun sekaligus. Dengan peta interaktif dan monitoring real-time, semua kebun terpantau dari satu dashboard saja.",
    author: "Ahmad Rizki",
    role: "Pengelola Perkebunan, Sumatera",
    rating: 5,
  },
  {
    quote:
      "Fitur prediksi cuaca BMKG sangat membantu. Kalau ada prediksi hujan, irigasi otomatis ditunda. Air terbuang lebih sedikit, biaya operasional turun.",
    author: "Dewi Lestari",
    role: "Petani Sayuran, Malang",
    rating: 5,
  },
  {
    quote:
      "Saya awalnya ragu sama teknologi. Tapi pasang sensor dan gateway cukup mudah. Dalam seminggu, saya sudah bisa pantau kebun dari HP.",
    author: "Pak Tarno",
    role: "Petani Melon, Yogyakarta",
    rating: 5,
  },
  {
    quote:
      "Untuk tanaman organik, kontrol air harus tepat. LoraField bantu kami menjaga kelembaban tanah ideal tanpa over-irigasi.",
    author: "Made Wirawan",
    role: "Petani Organik, Bali",
    rating: 5,
  },
]

const faqs = [
  {
    question: "Apa itu LoraField dan bagaimana cara kerjanya?",
    answer:
      "LoraField adalah sistem irigasi pintar berbasis web yang menggabungkan sensor IoT, data cuaca dari BMKG, dan otomatisasi katup. Sensor di kebunmu membaca kondisi tanah secara real-time, lalu sistem menentukan apakah irigasi perlu dibuka, ditutup, atau ditunda berdasarkan kelembaban tanah dan prediksi cuaca. Semua data bisa kamu pantau langsung dari dashboard.",
  },
  {
    question: "Apakah saya perlu keahlian teknis untuk memasang perangkat?",
    answer:
      "Tidak perlu. Perangkat sensor dan gateway dirancang agar mudah dipasang di lapangan. Setelah terhubung, kebunmu akan otomatis muncul di dashboard dan siap dikonfigurasi. Kami juga menyediakan panduan pemasangan langkah demi langkah.",
  },
  {
    question: "Berapa banyak kebun yang bisa saya kelola dalam satu akun?",
    answer:
      "Satu akun bisa mengelola banyak kebun sekaligus. Tiap kebun memiliki peta lokasi, jenis tanaman, node sensor, dan aturan irigasi yang independen. Jadi kalau kamu punya lahan di beberapa tempat, semua tetap terpantau dalam satu dashboard.",
  },
  {
    question: "Bagaimana jika lokasi kebun saya sulit terjangkau sinyal internet?",
    answer:
      "Gateway LoraField mengirim data melalui jaringan LoRa yang hemat daya dan jarak jangkauannya jauh. Selama ada sinyal seluler minimal di sekitar gateway, data tetap masuk ke dashboard. Kalau gateway sempat offline, sistem akan menunggu data kembali normal sebelum mengambil keputusan irigasi.",
  },
  {
    question: "Apakah sistem ini bisa digunakan untuk tanaman selain padi?",
    answer:
      "Bisa. LoraField mendukung lebih dari 30 jenis tanaman, mulai dari cabai, tomat, melon, hingga tanaman hias. Tiap tanaman memiliki ambang batas kelembaban tanah (VWC) yang sudah tersimpan di sistem, jadi irigasi akan disesuaikan dengan kebutuhan masing-masing.",
  },
  {
    question: "Apakah data kebun saya aman?",
    answer:
      "Sangat aman. Setiap pengguna hanya bisa mengakses kebun miliknya sendiri. Data sensor, riwayat irigasi, dan informasi profil dilindungi dengan enkripsi. Kami juga menggunakan autentikasi JWT dan verifikasi OTP untuk menjaga keamanan akun.",
  },
]

function BrandMark() {
  return (
    <div className="flex items-center font-bold">
      <span className="text-lg">LoraField</span>
    </div>
  )
}

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Tanpa bg-background di wrapper ini: itu background normal-flow yang akan
  // menimpa grid overlay ber-`-z-10` (paint order), bikin grid tak terlihat.
  // Background gelap halaman sudah disediakan body (index.css).
  return (
    <div className="landing-page flex min-h-[100dvh] flex-col text-foreground">
      <header
        className={`sticky top-0 z-50 w-full backdrop-blur-lg transition-all duration-300 ${isScrolled ? "bg-background/80 shadow-sm" : "bg-transparent"}`}
      >
        <div className={`${SHELL} relative flex h-16 items-center justify-between`}>
          <BrandMark />
          <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Fitur
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Testimoni
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              FAQ
            </a>
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Masuk
            </Link>
            <Button asChild className="rounded-lg">
              <Link to="/register">
                Mulai Sekarang
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-4 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 top-16 border-b bg-background/95 backdrop-blur-lg md:hidden"
          >
            <div className={`${SHELL} flex flex-col gap-4 py-4`}>
              <a href="#features" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Fitur
              </a>
              <a href="#testimonials" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Testimoni
              </a>
              <a href="#faq" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                FAQ
              </a>
              <div className="flex flex-col gap-2 border-t pt-2">
                <Link to="/login" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                  Masuk
                </Link>
                <Button asChild className="rounded-lg">
                  <Link to="/register">
                    Mulai Sekarang
                    <ChevronRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </header>
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full overflow-hidden py-20 md:py-32 lg:py-40">
          <div className={`${SHELL} relative`}>
            {/* Mask radial terpusat: grid penuh di tengah (area headline), memudar
                halus ke transparan SEBELUM mencapai keempat tepi (atas/bawah/kiri/
                kanan) — radius 70% dengan stop transparan di 70% bikin jarak ke tepi
                (~71%) sudah lewat titik transparan, jadi tak ada batas kotak tegas.
                #000/transparent = alpha mask (bukan warna). -webkit- untuk Safari. */}
            <div
              className={`absolute inset-0 -z-10 h-full w-full bg-background ${GRID} [-webkit-mask-image:radial-gradient(ellipse_88%_82%_at_50%_44%,#000_0%,transparent_78%)] [mask-image:radial-gradient(ellipse_88%_82%_at_50%_44%,#000_0%,transparent_78%)]`}
            ></div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-12 max-w-3xl text-center"
            >
              <h1 className="mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                LoraField, Satu Dashboard untuk Seluruh Kebunmu
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
                Platform monitoring lengkap dengan sensor kelembaban tanah, prakiraan cuaca BMKG, dan otomatisasi katup irigasi. Pantau kebunmu dari mana saja, ambil keputusan berbasis data, dan hemat air tanpa repot.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-lg px-8 text-base">
                  <Link to="/login">
                    Mulai Monitoring
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative mx-auto max-w-5xl"
            >
              <div className="overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-background to-muted/20 shadow-2xl">
                <img
                  src={DASHBOARD_PREVIEW_IMAGE_URL}
                  width={1280}
                  height={720}
                  alt="Pratinjau dashboard LoraField"
                  className="h-auto w-full"
                />
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/10"></div>
              </div>
              <div className="absolute -right-6 -bottom-6 -z-10 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 opacity-70 blur-3xl"></div>
              <div className="absolute -top-6 -left-6 -z-10 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 opacity-70 blur-3xl"></div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-32">
          <div className={SHELL}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
                Fitur
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Teknologi Irigasi Modern dalam Satu Platform</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                LoraField menggabungkan sensor IoT, data cuaca BMKG, dan otomatisasi katup untuk memberikan kontrol penuh atas irigasi kebunmu dari mana saja.
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((feature) => (
                <motion.div key={feature.title} variants={item}>
                  <Card className="h-full overflow-hidden border border-border/40 bg-gradient-to-b from-background to-muted/10 py-0 backdrop-blur transition-all hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-6">
                      <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {feature.icon}
                      </div>
                      <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="relative w-full overflow-hidden bg-muted/30 py-20 md:py-32">
          <div
            className={`absolute inset-0 -z-10 h-full w-full bg-background ${GRID} [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]`}
          ></div>

          <div className={`${SHELL} relative`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-16 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
                Tiga Langkah Mudah
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Pasang, Atur, Pantau. Selesai.</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Tidak perlu keahlian teknis. Cukup pasang perangkat, daftar kebun, dan biarkan sistem mengatur irigasi secara otomatis.
              </p>
            </motion.div>

            <div className="relative grid gap-8 md:grid-cols-3 md:gap-12">
              <div className="absolute top-1/2 right-0 left-0 z-0 hidden h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent md:block"></div>

              {steps.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative z-10 flex flex-col items-center space-y-4 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-lg">
                    {s.step}
                  </div>
                  <h3 className="text-xl font-bold">{s.title}</h3>
                  <p className="text-muted-foreground">{s.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="w-full py-20 md:py-32">
          <div className={SHELL}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
                Testimoni
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Dipercaya Petani di Berbagai Daerah</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Lihat bagaimana LoraField membantu petani menghemat air, mengurangi kerja manual, dan meningkatkan hasil panen.
              </p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial, i) => (
                <motion.div
                  key={testimonial.author}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <Card className="h-full overflow-hidden border border-border/40 bg-gradient-to-b from-background to-muted/10 py-0 backdrop-blur transition-all hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-6">
                      <div className="mb-4 flex">
                        {Array(testimonial.rating)
                          .fill(0)
                          .map((_, j) => (
                            <Star key={j} className="size-4 fill-primary text-primary" />
                          ))}
                      </div>
                      <p className="mb-6 flex-grow text-lg">{testimonial.quote}</p>
                      <div className="mt-auto flex items-center gap-4 border-t border-border/40 pt-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted font-medium text-foreground">
                          {testimonial.author.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{testimonial.author}</p>
                          <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="w-full py-20 md:py-32">
          <div className={SHELL}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-md px-4 py-1.5 text-sm font-medium" variant="secondary">
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Pertanyaan yang Sering Diajukan</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Temukan jawaban untuk pertanyaan umum tentang platform kami.
              </p>
            </motion.div>

            <div className="mx-auto max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, i) => (
                  <motion.div
                    key={faq.question}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    <AccordionItem value={`item-${i}`} className="border-b border-border/40 py-2">
                      <AccordionTrigger className="text-left font-medium hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary to-primary/80 py-20 text-primary-foreground md:py-32">
          <div className={`absolute inset-0 -z-10 ${GRID}`}></div>
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-foreground/10 blur-3xl"></div>
          <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-foreground/10 blur-3xl"></div>

          <div className={`${SHELL} relative`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-6 text-center"
            >
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                Siap Wujudkan Irigasi Pintar di Kebunmu?
              </h2>
              <p className="mx-auto max-w-[700px] text-primary-foreground/80 md:text-xl">
                Bergabunglah dengan petani yang sudah menghemat air, mengurangi kerja manual, dan meningkatkan hasil panen dengan LoraField.
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" variant="secondary" className="h-12 rounded-lg px-8 text-base">
                  <Link to="/login">
                    Mulai Monitoring
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t bg-background/95 backdrop-blur-sm">
        <div className={`${SHELL} flex flex-col gap-8 py-10 lg:py-16`}>
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <span className="text-lg font-bold">LoraField</span>
              <p className="text-sm text-muted-foreground">
                Sistem irigasi pintar berbasis web dengan sensor IoT, data cuaca BMKG, dan otomatisasi katup. Pantau dan kendalikan kebunmu dari mana saja.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Navigasi</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">
                    Fitur
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-muted-foreground transition-colors hover:text-foreground">
                    Testimoni
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
