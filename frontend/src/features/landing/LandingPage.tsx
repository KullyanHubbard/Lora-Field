import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "motion/react"
import {
  ArrowRight,
  BarChart,
  Check,
  ChevronRight,
  Layers,
  Menu,
  Shield,
  Sprout,
  Star,
  Users,
  X,
  Zap,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Lebar konten + padding horizontal yang konsisten. Tailwind v4 di proyek ini
// tidak mengonfigurasi utility `container` (center/padding), jadi pakai kelas
// eksplisit ini sebagai gantinya.
const SHELL = "mx-auto w-full max-w-7xl px-4 md:px-6"

// Grid garis dekoratif. Warna garis pakai token tema --grid-line (didefinisikan
// di index.css), bukan hex hardcoded. Referensi var() bebas koma — penting karena
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
    title: "Smart Automation",
    description: "Automate repetitive tasks and workflows to save time and reduce errors.",
    icon: <Zap className="size-5" />,
  },
  {
    title: "Advanced Analytics",
    description: "Gain valuable insights with real-time data visualization and reporting.",
    icon: <BarChart className="size-5" />,
  },
  {
    title: "Team Collaboration",
    description: "Work together seamlessly with integrated communication tools.",
    icon: <Users className="size-5" />,
  },
  {
    title: "Enterprise Security",
    description: "Keep your data safe with end-to-end encryption and compliance features.",
    icon: <Shield className="size-5" />,
  },
  {
    title: "Seamless Integration",
    description: "Connect with your favorite tools through our extensive API ecosystem.",
    icon: <Layers className="size-5" />,
  },
  {
    title: "24/7 Support",
    description: "Get help whenever you need it with our dedicated support team.",
    icon: <Star className="size-5" />,
  },
]

const steps = [
  {
    step: "01",
    title: "Create Account",
    description: "Sign up in seconds with just your email. No credit card required to get started.",
  },
  {
    step: "02",
    title: "Configure Workspace",
    description: "Customize your workspace to match your team's unique workflow and requirements.",
  },
  {
    step: "03",
    title: "Boost Productivity",
    description: "Start using our powerful features to streamline processes and achieve your goals.",
  },
]

const testimonials = [
  {
    quote:
      "SaaSify has transformed how we manage our projects. The automation features have saved us countless hours of manual work.",
    author: "Sarah Johnson",
    role: "Project Manager, TechCorp",
    rating: 5,
  },
  {
    quote:
      "The analytics dashboard provides insights we never had access to before. It's helped us make data-driven decisions that have improved our ROI.",
    author: "Michael Chen",
    role: "Marketing Director, GrowthLabs",
    rating: 5,
  },
  {
    quote:
      "Customer support is exceptional. Any time we've had an issue, the team has been quick to respond and resolve it. Couldn't ask for better service.",
    author: "Emily Rodriguez",
    role: "Operations Lead, StartupX",
    rating: 5,
  },
  {
    quote:
      "We've tried several similar solutions, but none compare to the ease of use and comprehensive features of SaaSify. It's been a game-changer.",
    author: "David Kim",
    role: "CEO, InnovateNow",
    rating: 5,
  },
  {
    quote:
      "The collaboration tools have made remote work so much easier for our team. We're more productive than ever despite being spread across different time zones.",
    author: "Lisa Patel",
    role: "HR Director, RemoteFirst",
    rating: 5,
  },
  {
    quote:
      "Implementation was seamless, and the ROI was almost immediate. We've reduced our operational costs by 30% since switching to SaaSify.",
    author: "James Wilson",
    role: "COO, ScaleUp Inc",
    rating: 5,
  },
]

type Plan = {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  popular?: boolean
}

const monthlyPlans: Plan[] = [
  {
    name: "Starter",
    price: "$29",
    description: "Perfect for small teams and startups.",
    features: ["Up to 5 team members", "Basic analytics", "5GB storage", "Email support"],
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    price: "$79",
    description: "Ideal for growing businesses.",
    features: [
      "Up to 20 team members",
      "Advanced analytics",
      "25GB storage",
      "Priority email support",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$199",
    description: "For large organizations with complex needs.",
    features: [
      "Unlimited team members",
      "Custom analytics",
      "Unlimited storage",
      "24/7 phone & email support",
      "Advanced API access",
      "Custom integrations",
    ],
    cta: "Contact Sales",
  },
]

const annualPlans: Plan[] = [
  {
    name: "Starter",
    price: "$23",
    description: "Perfect for small teams and startups.",
    features: ["Up to 5 team members", "Basic analytics", "5GB storage", "Email support"],
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    price: "$63",
    description: "Ideal for growing businesses.",
    features: [
      "Up to 20 team members",
      "Advanced analytics",
      "25GB storage",
      "Priority email support",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$159",
    description: "For large organizations with complex needs.",
    features: [
      "Unlimited team members",
      "Custom analytics",
      "Unlimited storage",
      "24/7 phone & email support",
      "Advanced API access",
      "Custom integrations",
    ],
    cta: "Contact Sales",
  },
]

const faqs = [
  {
    question: "How does the 14-day free trial work?",
    answer:
      "Our 14-day free trial gives you full access to all features of your selected plan. No credit card is required to sign up, and you can cancel at any time during the trial period with no obligation.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. If you upgrade, the new pricing will be prorated for the remainder of your billing cycle. If you downgrade, the new pricing will take effect at the start of your next billing cycle.",
  },
  {
    question: "Is there a limit to how many users I can add?",
    answer:
      "The number of users depends on your plan. The Starter plan allows up to 5 team members, the Professional plan allows up to 20, and the Enterprise plan has no limit on team members.",
  },
  {
    question: "Do you offer discounts for nonprofits or educational institutions?",
    answer:
      "Yes, we offer special pricing for nonprofits, educational institutions, and open-source projects. Please contact our sales team for more information.",
  },
  {
    question: "How secure is my data?",
    answer:
      "We take security very seriously. All data is encrypted both in transit and at rest. We use industry-standard security practices and regularly undergo security audits. Our platform is compliant with GDPR, CCPA, and other relevant regulations.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "Support varies by plan. All plans include email support, with the Professional plan offering priority email support. The Enterprise plan includes 24/7 phone and email support. We also have an extensive knowledge base and community forum available to all users.",
  },
]

function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-bold">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Sprout className="size-5" />
      </div>
      <span>LoraField</span>
    </div>
  )
}

function PlanGrid({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
      {plans.map((plan, i) => (
        <motion.div
          key={plan.name}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
        >
          <Card
            className={`relative h-full overflow-hidden py-0 ${plan.popular ? "ring-2 ring-primary" : ""} bg-gradient-to-b from-background to-muted/10 backdrop-blur`}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most Popular
              </div>
            )}
            <CardContent className="flex h-full flex-col p-6">
              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="ml-1 text-muted-foreground">/month</span>
              </div>
              <p className="mt-2 text-muted-foreground">{plan.description}</p>
              <ul className="my-6 flex-grow space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="mr-2 size-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-auto w-full rounded-full"
                variant={plan.popular ? "default" : "outline"}
              >
                <Link to="/login">{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
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
    <div className="flex min-h-[100dvh] flex-col text-foreground">
      <header
        className={`sticky top-0 z-50 w-full backdrop-blur-lg transition-all duration-300 ${isScrolled ? "bg-background/80 shadow-sm" : "bg-transparent"}`}
      >
        <div className={`${SHELL} flex h-16 items-center justify-between`}>
          <BrandMark />
          <nav className="hidden gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Testimonials
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
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
              Log in
            </Link>
            <Button asChild className="rounded-full">
              <Link to="/login">
                Get Started
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
                Features
              </a>
              <a href="#testimonials" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Testimonials
              </a>
              <a href="#pricing" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </a>
              <a href="#faq" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                FAQ
              </a>
              <div className="flex flex-col gap-2 border-t pt-2">
                <Link to="/login" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                  Log in
                </Link>
                <Button asChild className="rounded-full">
                  <Link to="/login">
                    Get Started
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
              className={`absolute inset-0 -z-10 h-full w-full bg-background ${GRID} [-webkit-mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_0%,transparent_70%)] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_0%,transparent_70%)]`}
            ></div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-12 max-w-3xl text-center"
            >
              <Badge className="mb-4 rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Launching Soon
              </Badge>
              <h1 className="mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl lg:text-6xl">
                Elevate Your Workflow with SaaSify
              </h1>
              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
                The all-in-one platform that helps teams collaborate, automate, and deliver exceptional results.
                Streamline your processes and focus on what matters most.
              </p>
              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
                  <Link to="/login">
                    Start Free Trial
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-8 text-base">
                  <Link to="/login">Book a Demo</Link>
                </Button>
              </div>
              <div className="mt-6 flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Check className="size-4 text-primary" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="size-4 text-primary" />
                  <span>14-day trial</span>
                </div>
                <div className="flex items-center gap-1">
                  <Check className="size-4 text-primary" />
                  <span>Cancel anytime</span>
                </div>
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
                  src="https://cdn.dribbble.com/userupload/12302729/file/original-fa372845e394ee85bebe0389b9d86871.png?resize=1504x1128&vertical=center"
                  width={1280}
                  height={720}
                  alt="SaaSify dashboard"
                  className="h-auto w-full"
                />
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-foreground/10"></div>
              </div>
              <div className="absolute -right-6 -bottom-6 -z-10 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 opacity-70 blur-3xl"></div>
              <div className="absolute -top-6 -left-6 -z-10 h-[300px] w-[300px] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 opacity-70 blur-3xl"></div>
            </motion.div>
          </div>
        </section>

        {/* Logos Section */}
        <section className="w-full border-y bg-muted/30 py-12">
          <div className={SHELL}>
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">Trusted by innovative companies worldwide</p>
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 lg:gap-16">
                {[1, 2, 3, 4, 5].map((i) => (
                  <img
                    key={i}
                    src="/placeholder-logo.svg"
                    alt={`Company logo ${i}`}
                    width={120}
                    height={60}
                    className="h-8 w-auto opacity-60 grayscale invert transition-all hover:opacity-100"
                  />
                ))}
              </div>
            </div>
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
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Features
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything You Need to Succeed</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Our comprehensive platform provides all the tools you need to streamline your workflow, boost
                productivity, and achieve your goals.
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
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                How It Works
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Simple Process, Powerful Results</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Get started in minutes and see the difference our platform can make for your business.
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
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Testimonials
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Loved by Teams Worldwide</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Don't just take our word for it. See what our customers have to say about their experience.
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

        {/* Pricing Section */}
        <section id="pricing" className="relative w-full overflow-hidden bg-muted/30 py-20 md:py-32">
          <div
            className={`absolute inset-0 -z-10 h-full w-full bg-background ${GRID} [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]`}
          ></div>

          <div className={`${SHELL} relative`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                Pricing
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Simple, Transparent Pricing</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Choose the plan that's right for your business. All plans include a 14-day free trial.
              </p>
            </motion.div>

            <div className="mx-auto max-w-5xl">
              <Tabs defaultValue="monthly" className="w-full">
                <div className="mb-8 flex justify-center">
                  <TabsList className="rounded-full p-1">
                    <TabsTrigger value="monthly" className="rounded-full px-6">
                      Monthly
                    </TabsTrigger>
                    <TabsTrigger value="annually" className="rounded-full px-6">
                      Annually (Save 20%)
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="monthly">
                  <PlanGrid plans={monthlyPlans} />
                </TabsContent>
                <TabsContent value="annually">
                  <PlanGrid plans={annualPlans} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="w-full py-20 md:py-32">
          <div className={SHELL}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 flex flex-col items-center justify-center space-y-4 text-center"
            >
              <Badge className="rounded-full px-4 py-1.5 text-sm font-medium" variant="secondary">
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Frequently Asked Questions</h2>
              <p className="max-w-[800px] text-muted-foreground md:text-lg">
                Find answers to common questions about our platform.
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
                Ready to Transform Your Workflow?
              </h2>
              <p className="mx-auto max-w-[700px] text-primary-foreground/80 md:text-xl">
                Join thousands of satisfied customers who have streamlined their processes and boosted productivity with
                our platform.
              </p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-8 text-base">
                  <Link to="/login">
                    Start Free Trial
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-primary-foreground/30 bg-transparent px-8 text-base text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link to="/login">Schedule a Demo</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-primary-foreground/80">
                No credit card required. 14-day free trial. Cancel anytime.
              </p>
            </motion.div>
          </div>
        </section>
      </main>
      <footer className="w-full border-t bg-background/95 backdrop-blur-sm">
        <div className={`${SHELL} flex flex-col gap-8 py-10 lg:py-16`}>
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-4">
              <BrandMark />
              <p className="text-sm text-muted-foreground">
                Streamline your workflow with our all-in-one SaaS platform. Boost productivity and scale your business.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                  >
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                  <span className="sr-only">Facebook</span>
                </a>
                <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                  >
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                  </svg>
                  <span className="sr-only">Twitter</span>
                </a>
                <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                  >
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect width="4" height="12" x="2" y="9"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                  <span className="sr-only">LinkedIn</span>
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Integrations
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Guides
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SaaSify. All rights reserved.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Privacy Policy
              </a>
              <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Terms of Service
              </a>
              <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
