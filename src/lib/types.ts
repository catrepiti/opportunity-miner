export interface Lead {
  id: string
  name: string
  niche: NicheType
  region: string
  city: string
  state: string
  phone: string | null
  phones: string[]
  email: string | null
  whatsapp: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  googleMapsUrl: string | null
  googleRating: number | null
  googleReviews: number | null
  address: string | null
  score: number
  digitalMaturityScore: number
  businessViabilityScore: number
  accessibilityScore: number
  aiInsight: string | null
  approachSuggestion: string | null
  status: LeadStatus
  createdAt: string
  updatedAt: string
}

export type NicheType =
  | 'clinica_estetica'
  | 'saude_bem_estar'
  | 'salao_barbearia'
  | 'nutricionista'
  | 'fisioterapia'
  | 'psicologia'
  | 'personal_trainer'
  | 'odontologia'
  | 'dermatologia'
  | 'spa_massagem'

export type LeadStatus = 'novo' | 'analisando' | 'qualificado' | 'contatado' | 'descartado'

export interface MiningRequest {
  niches: NicheType[]
  regions: RegionConfig[]
  depth: 'rapida' | 'normal' | 'profunda'
}

export interface RegionConfig {
  city: string
  state: string
}

export interface MiningResult {
  totalFound: number
  leads: Lead[]
  searchQueries: string[]
  duration: number
}

export interface WebsiteAnalysis {
  hasWebsite: boolean
  hasSsl: boolean
  isMobileResponsive: boolean
  loadTimeMs: number | null
  hasSeo: boolean
  socialLinks: string[]
  hasWhatsapp: boolean
  quality: 'inexistente' | 'ruim' | 'basico' | 'bom' | 'excelente'
  extractedContacts: ExtractedContacts
}

export interface ExtractedContacts {
  phones: string[]
  emails: string[]
  whatsapp: string | null
  address: string | null
  instagramHandle: string | null
  facebookUrl: string | null
}

export interface SocialAnalysis {
  hasInstagram: boolean
  instagramFollowers: number | null
  instagramPosts: number | null
  hasFacebook: boolean
  hasGoogleBusiness: boolean
  overallPresence: 'inexistente' | 'fraca' | 'moderada' | 'forte'
}

export interface ScoringFactors {
  digitalMaturity: {
    noWebsite: boolean
    poorWebsite: boolean
    noInstagram: boolean
    lowEngagement: boolean
    noFacebook: boolean
    noPaidAds: boolean
    poorSeo: boolean
  }
  businessViability: {
    hasGoogleReviews: boolean
    positiveRating: boolean
    recentActivity: boolean
    establishedBusiness: boolean
    highDemandNiche: boolean
  }
  accessibility: {
    hasPhone: boolean
    hasWhatsapp: boolean
    hasInstagramDm: boolean
    hasEmail: boolean
    inTargetRegion: boolean
  }
}

export const NICHE_LABELS: Record<NicheType, string> = {
  clinica_estetica: 'Clínica de Estética',
  saude_bem_estar: 'Saúde e Bem-Estar',
  salao_barbearia: 'Salão / Barbearia',
  nutricionista: 'Nutricionista',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia',
  personal_trainer: 'Personal Trainer',
  odontologia: 'Odontologia',
  dermatologia: 'Dermatologia',
  spa_massagem: 'Spa / Massagem',
}

export const NICHE_SEARCH_TERMS: Record<NicheType, string[]> = {
  clinica_estetica: [
    'clínica de estética', 'harmonização facial', 'botox',
    'preenchimento labial', 'limpeza de pele', 'peeling',
    'microagulhamento', 'depilação a laser',
  ],
  saude_bem_estar: [
    'clínica de saúde', 'centro de bem-estar', 'medicina integrativa',
    'acupuntura', 'pilates studio',
  ],
  salao_barbearia: [
    'salão de beleza', 'barbearia', 'cabeleireiro',
    'extensão de cílios', 'nail designer', 'manicure',
    'design de sobrancelha',
  ],
  nutricionista: ['nutricionista', 'consultório nutricional', 'nutrição esportiva'],
  fisioterapia: ['fisioterapia', 'fisioterapeuta', 'clínica de fisioterapia', 'RPG fisioterapia'],
  psicologia: ['psicólogo', 'psicóloga', 'consultório psicologia', 'terapia'],
  personal_trainer: ['personal trainer', 'treinador pessoal', 'studio de treino', 'assessoria esportiva'],
  odontologia: ['dentista', 'clínica odontológica', 'consultório dentário', 'ortodontia'],
  dermatologia: ['dermatologista', 'clínica dermatológica', 'dermatologia estética'],
  spa_massagem: ['spa', 'massagem', 'massoterapia', 'day spa'],
}
