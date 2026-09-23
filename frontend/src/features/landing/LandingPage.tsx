import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
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
import heroPreviewImage from "@/assets/Hero-Preview1.png"
import "./LandingPage.css"

// Lebar konten + padding horizontal yang konsisten.
const SHELL = "mx-auto w-full max-w-7xl px-4 md:px-6"

// Grid garis dekoratif.
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

// Ikon statis, digabung ke teks i18n saat render.
const FEATURE_ICONS = [
  <Activity className="size-5" key="activity" />,
  <Droplets className="size-5" key="droplets" />,
  <CloudSun className="size-5" key="cloudsun" />,
  <Sprout className="size-5" key="sprout" />,
  <MapPin className="size-5" key="mappin" />,
  <History className="size-5" key="history" />,
]

// Testimoni sengaja tidak diterjemahkan, ini konten user.
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
      "Untuk tanaman organik, kontrol air harus tepat. LoraField bantu kami menjaga kelembaban tanah ideal tanpa over-irrigasi.",
    author: "Made Wirawan",
    role: "Petani Organik, Bali",
    rating: 5,
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
  const { t } = useTranslation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const featuresItems = t(
    "landing.featuresItems",
    { returnObjects: true },
  ) as Array<{ title: string; description: string }>
  const stepsItems = t(
    "landing.stepsItems",
    { returnObjects: true },
  ) as Array<{ step: string; title: string; description: string }>
  const faqItems = t(
    "landing.faqItems",
    { returnObjects: true },
  ) as Array<{ question: string; answer: string }>

  const handleImageError = useCallback(() => setImageError(true), [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

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
              {t("landing.navFeatures")}
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.navTestimonials")}
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.navFaq")}
            </a>
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            <Link
              to="/login"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("landing.navLogin")}
            </Link>
            <Button asChild className="rounded-lg">
              <Link to="/register">
                {t("landing.navStart")}
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
              <span className="sr-only">{t("landing.toggleMenu")}</span>
            </Button>
          </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence mode="wait">
          {mobileMenuOpen ? (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 top-16 border-b bg-background/95 backdrop-blur-lg md:hidden"
            >
              <div className={`${SHELL} flex flex-col gap-4 py-4`}>
                <a href="#features" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                  {t("landing.navFeatures")}
                </a>
                <a href="#testimonials" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                  {t("landing.navTestimonials")}
                </a>
                <a href="#faq" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                  {t("landing.navFaq")}
                </a>
                <div className="flex flex-col gap-2 border-t pt-2">
                  <Link to="/login" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                    {t("landing.navLogin")}
                  </Link>
                  <Button asChild className="rounded-lg">
                    <Link to="/register">
                      {t("landing.navStart")}
                      <ChevronRight className="ml-1 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full overflow-hidden py-20 md:py-32 lg:py-40">
          <div className={`${SHELL} relative`}>
            <div
              className={`absolute inset-0 -z-10 h-full w-full bg-background ${GRID} [-webkit-mask-image:radial-gradient(ellipse_60%_150%_at_50%_55%,#000_0%,transparent_78%)] [mask-image:radial-gradient(ellipse_60%_150%_at_50%_55%,#000_0%,transparent_78%)]`}
            ></div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-6 max-w-3xl text-center"
            >
              <h1 className="mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                {t("landing.heroTitle")}
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
                {t("landing.heroSubtitle")}
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-lg px-8 text-base">
                  <Link to="/login">
                    {t("landing.heroCta")}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative mx-auto max-w-[77.09554944rem]"
            >
              <div className="overflow-hidden rounded-xl border border-border/40 bg-gradient-to-b from-background to-muted/20 shadow-2xl">
                {!imageError && (
                  <img
                    src={heroPreviewImage}
                    onError={handleImageError}
                    width={1919}
                    height={946}
                    alt={t("landing.heroImageAlt")}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="h-auto w-full"
                  />
                )}
                {imageError && (
                  <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground">
                    <p className="text-sm">{t("landing.heroImageFallback")}</p>
                  </div>
                )}
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
                {t("landing.featuresBadge")}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t("landing.featuresTitle")}
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                {t("landing.featuresSubtitle")}
              </p>
            </motion.div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {featuresItems.map((feature, idx) => (
                <motion.div key={feature.title} variants={item}>
                  <Card className="h-full overflow-hidden border border-border/40 bg-gradient-to-b from-background to-muted/10 py-0 backdrop-blur transition-all hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-6">
                      <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {FEATURE_ICONS[idx]}
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
                {t("landing.howItWorksBadge")}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t("landing.howItWorksTitle")}
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                {t("landing.howItWorksSubtitle")}
              </p>
            </motion.div>

            <div className="relative grid gap-8 md:grid-cols-3 md:gap-12">
              <div className="absolute top-1/2 right-0 left-0 z-0 hidden h-0.5 -translate-y-1/2 bg-gradient-to-r from-transparent via-border to-transparent md:block"></div>

              {stepsItems.map((s, i) => (
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
                {t("landing.navTestimonials")}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t("landing.testimonialsTitle")}
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                {t("landing.testimonialsSubtitle")}
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
                {t("landing.navFaq")}
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                {t("landing.faqTitle")}
              </h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                {t("landing.faqSubtitle")}
              </p>
            </motion.div>

            <div className="mx-auto max-w-3xl">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((faq, i) => (
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
                {t("landing.ctaTitle")}
              </h2>
              <p className="mx-auto max-w-[700px] text-primary-foreground/80 md:text-xl">
                {t("landing.ctaSubtitle")}
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" variant="secondary" className="h-12 rounded-lg px-8 text-base">
                  <Link to="/login">
                    {t("landing.ctaButton")}
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
              <span className="text-lg font-bold">{t("landing.footerAbout")}</span>
              <p className="text-sm text-muted-foreground">
                {t("landing.footerAboutDesc")}
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">{t("landing.footerNav")}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                    {t("landing.footerFeatures")}
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-muted-foreground transition-colors hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                    {t("landing.footerTestimonials")}
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
                    {t("landing.footerFaq")}
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
