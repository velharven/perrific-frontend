import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import ProblemSection from '@/components/landing/ProblemSection';
import SolutionSection from '@/components/landing/SolutionSection';
import ComparisonSection from '@/components/landing/ComparisonSection';
import HowItWorks from '@/components/landing/HowItWorks';
import PersonaSection from '@/components/landing/PersonaSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-perrific-paper font-manrope">
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <ComparisonSection />
        <HowItWorks />
        <PersonaSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
