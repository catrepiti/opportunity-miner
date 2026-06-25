import { WebsiteAnalysis, ScoringFactors, NicheType } from './types'

const HIGH_DEMAND_NICHES: NicheType[] = [
  'clinica_estetica',
  'odontologia',
  'dermatologia',
  'nutricionista',
]

export function calculateScore(
  websiteAnalysis: WebsiteAnalysis,
  hasInstagram: boolean,
  hasFacebook: boolean,
  googleRating: number | null,
  googleReviews: number | null,
  hasPhone: boolean,
  hasWhatsapp: boolean,
  niche: NicheType,
): { total: number; digital: number; viability: number; access: number; factors: ScoringFactors } {

  const factors: ScoringFactors = {
    digitalMaturity: {
      noWebsite: !websiteAnalysis.hasWebsite,
      poorWebsite: websiteAnalysis.quality === 'ruim' || websiteAnalysis.quality === 'basico',
      noInstagram: !hasInstagram,
      lowEngagement: hasInstagram,
      noFacebook: !hasFacebook,
      noPaidAds: true,
      poorSeo: !websiteAnalysis.hasSeo,
    },
    businessViability: {
      hasGoogleReviews: (googleReviews ?? 0) > 0,
      positiveRating: (googleRating ?? 0) >= 3.5,
      recentActivity: true,
      establishedBusiness: (googleReviews ?? 0) > 5,
      highDemandNiche: HIGH_DEMAND_NICHES.includes(niche),
    },
    accessibility: {
      hasPhone: hasPhone,
      hasWhatsapp: hasWhatsapp,
      hasInstagramDm: hasInstagram,
      hasEmail: false,
      inTargetRegion: true,
    },
  }

  let digitalScore = 0
  if (factors.digitalMaturity.noWebsite) digitalScore += 15
  else if (factors.digitalMaturity.poorWebsite) digitalScore += 10
  if (factors.digitalMaturity.noInstagram) digitalScore += 10
  else if (factors.digitalMaturity.lowEngagement) digitalScore += 3
  if (factors.digitalMaturity.noFacebook) digitalScore += 5
  if (factors.digitalMaturity.noPaidAds) digitalScore += 5
  if (factors.digitalMaturity.poorSeo) digitalScore += 5
  digitalScore = Math.min(40, digitalScore)

  let viabilityScore = 0
  if (factors.businessViability.hasGoogleReviews) viabilityScore += 8
  if (factors.businessViability.positiveRating) viabilityScore += 7
  if (factors.businessViability.recentActivity) viabilityScore += 5
  if (factors.businessViability.establishedBusiness) viabilityScore += 5
  if (factors.businessViability.highDemandNiche) viabilityScore += 5
  viabilityScore = Math.min(30, viabilityScore)

  let accessScore = 0
  if (factors.accessibility.hasPhone) accessScore += 10
  if (factors.accessibility.hasWhatsapp) accessScore += 8
  if (factors.accessibility.hasInstagramDm) accessScore += 5
  if (factors.accessibility.inTargetRegion) accessScore += 5
  accessScore = Math.min(30, accessScore)

  const total = digitalScore + viabilityScore + accessScore

  return {
    total: Math.min(100, total),
    digital: digitalScore,
    viability: viabilityScore,
    access: accessScore,
    factors,
  }
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Ouro'
  if (score >= 60) return 'Prata'
  if (score >= 40) return 'Bronze'
  return 'Baixo'
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#eab308'
  if (score >= 60) return '#94a3b8'
  if (score >= 40) return '#d97706'
  return '#6b7280'
}
