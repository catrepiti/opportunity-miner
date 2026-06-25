import * as cheerio from 'cheerio'
import { WebsiteAnalysis, ExtractedContacts } from '../types'

function extractPhones(text: string): string[] {
  const patterns = [
    /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g,
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g,
  ]
  const found = new Set<string>()
  for (const pattern of patterns) {
    const matches = text.match(pattern) ?? []
    for (const m of matches) {
      const clean = m.replace(/[^\d+]/g, '')
      if (clean.length >= 10) found.add(clean)
    }
  }
  return [...found]
}

function extractEmails(text: string): string[] {
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(pattern) ?? []
  const blocked = ['example.com', 'email.com', 'sentry.io', 'wixpress.com', 'w3.org']
  return [...new Set(
    matches.filter(e => !blocked.some(b => e.includes(b)) && !e.includes('.png') && !e.includes('.jpg'))
  )]
}

function extractWhatsapp($: cheerio.CheerioAPI, bodyText: string): string | null {
  const waLinks: string[] = []
  $('a[href*="wa.me"], a[href*="whatsapp"], a[href*="api.whatsapp"]').each((_, el) => {
    waLinks.push($(el).attr('href') ?? '')
  })

  for (const link of waLinks) {
    const match = link.match(/wa\.me\/(\+?\d+)/) ?? link.match(/phone=(\+?\d+)/)
    if (match) return match[1]
  }

  const waMatch = bodyText.match(/whatsapp[:\s]*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/i)
  if (waMatch) {
    const nums = waMatch[0].replace(/[^\d]/g, '')
    if (nums.length >= 10) return nums
  }

  return null
}

function extractAddress($: cheerio.CheerioAPI, bodyText: string): string | null {
  const addressSelectors = [
    '[itemprop="address"]', '[itemtype*="PostalAddress"]',
    '.address', '.endereco', '#address', '#endereco',
    '[class*="address"]', '[class*="endereco"]', '[class*="localizacao"]',
  ]

  for (const sel of addressSelectors) {
    const el = $(sel).first()
    if (el.length) {
      const text = el.text().trim().replace(/\s+/g, ' ')
      if (text.length > 10 && text.length < 200) return text
    }
  }

  const patterns = [
    /(?:Rua|Av\.?|Avenida|Travessa|Alameda|Praça)\s+[^,\n]{5,60},?\s*(?:n[º°.]?\s*\d+)?[^,\n]{0,30},?\s*(?:CEP\s*)?(?:\d{5}-?\d{3})?/i,
  ]
  for (const pat of patterns) {
    const match = bodyText.match(pat)
    if (match) return match[0].trim().replace(/\s+/g, ' ').slice(0, 150)
  }

  return null
}

function extractInstagram($: cheerio.CheerioAPI): string | null {
  const reserved = ['p', 'explore', 'accounts', 'reel', 'stories', 'reels', 'tv', 'about', 'developer']
  let handle: string | null = null
  $('a[href*="instagram.com"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const match = href.match(/instagram\.com\/([a-zA-Z0-9_.]+)/)
    if (match && !reserved.includes(match[1].toLowerCase())) {
      handle = `@${match[1]}`
      return false
    }
  })
  return handle
}

function extractFacebook($: cheerio.CheerioAPI): string | null {
  let url: string | null = null
  $('a[href*="facebook.com"]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.includes('/sharer') || href.includes('/dialog') || href.includes('/share.php')) return
    url = href
    return false
  })
  return url
}

export async function analyzeWebsite(url: string): Promise<WebsiteAnalysis> {
  const emptyContacts: ExtractedContacts = {
    phones: [], emails: [], whatsapp: null,
    address: null, instagramHandle: null, facebookUrl: null,
  }

  const result: WebsiteAnalysis = {
    hasWebsite: false, hasSsl: false, isMobileResponsive: false,
    loadTimeMs: null, hasSeo: false, socialLinks: [],
    hasWhatsapp: false, quality: 'inexistente', extractedContacts: { ...emptyContacts },
  }

  if (!url) return result

  try {
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`
    const startTime = Date.now()

    const response = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    result.loadTimeMs = Date.now() - startTime
    result.hasWebsite = response.ok
    result.hasSsl = response.url.startsWith('https://')

    if (!response.ok) {
      result.quality = 'ruim'
      return result
    }

    const html = await response.text()
    const $ = cheerio.load(html)
    const bodyText = $('body').text()
    const bodyLower = bodyText.toLowerCase()

    const viewport = $('meta[name="viewport"]').attr('content')
    result.isMobileResponsive = !!viewport && viewport.includes('width=device-width')

    const title = $('title').text().trim()
    const metaDesc = $('meta[name="description"]').attr('content')
    const h1 = $('h1').first().text().trim()
    result.hasSeo = !!(title && title.length > 5 && (metaDesc || h1))

    const socialPatterns = [
      { pattern: /instagram\.com/i, prefix: 'instagram' },
      { pattern: /facebook\.com/i, prefix: 'facebook' },
      { pattern: /wa\.me|whatsapp/i, prefix: 'whatsapp' },
      { pattern: /youtube\.com/i, prefix: 'youtube' },
      { pattern: /tiktok\.com/i, prefix: 'tiktok' },
    ]

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? ''
      for (const { pattern, prefix } of socialPatterns) {
        if (pattern.test(href)) {
          result.socialLinks.push(`${prefix}:${href}`)
          if (prefix === 'whatsapp') result.hasWhatsapp = true
        }
      }
    })

    if (bodyLower.includes('whatsapp') || bodyLower.includes('wa.me')) {
      result.hasWhatsapp = true
    }

    result.extractedContacts = {
      phones: extractPhones(bodyText).slice(0, 5),
      emails: extractEmails(bodyText),
      whatsapp: extractWhatsapp($, bodyText),
      address: extractAddress($, bodyText),
      instagramHandle: extractInstagram($),
      facebookUrl: extractFacebook($),
    }

    if (result.extractedContacts.whatsapp) result.hasWhatsapp = true

    let qualityScore = 0
    if (result.hasSsl) qualityScore++
    if (result.isMobileResponsive) qualityScore++
    if (result.hasSeo) qualityScore++
    if (result.loadTimeMs < 3000) qualityScore++
    if (result.socialLinks.length > 0) qualityScore++

    if (qualityScore >= 4) result.quality = 'excelente'
    else if (qualityScore >= 3) result.quality = 'bom'
    else if (qualityScore >= 2) result.quality = 'basico'
    else result.quality = 'ruim'

  } catch {
    result.quality = result.hasWebsite ? 'ruim' : 'inexistente'
  }

  return result
}
