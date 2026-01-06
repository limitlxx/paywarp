import { OnboardingFlow } from "@/components/onboarding-flow"
import { PriceTest } from "@/components/price-test"

export default function LandingPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* <PriceTest /> */}
        <OnboardingFlow />
      </div>
    </div>
  )
}
