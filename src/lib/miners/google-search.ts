import * as cheerio from 'cheerio'
import { NicheType, NICHE_SEARCH_TERMS } from '../types'

export interface RawSearchResult {
  title: string
  url: string
  snippet: string
  phone: string | null
  address: string | null
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractPhone(text: string): string | null {
  const phoneRegex = /\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g
  const match = text.match(phoneRegex)
  return match ? match[0].replace(/[^\d]/g, '') : null
}

export async function searchDuckDuckGo(query: string): Promise<RawSearchResult[]> {
  const results: RawSearchResult[] = []

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return results

    const html = await response.text()
    const $ = cheerio.load(html)

    $('.result').each((_, el) => {
      const titleEl = $(el).find('.result__a')
      const snippetEl = $(el).find('.result__snippet')
      const urlEl = $(el).find('.result__url')

      const title = titleEl.text().trim()
      let href = urlEl.text().trim()
      const snippet = snippetEl.text().trim()

      if (!title || !href) return

      if (!href.startsWith('http')) href = `https://${href}`

      const phone = extractPhone(snippet)

      results.push({
        title,
        url: href,
        snippet,
        phone,
        address: null,
      })
    })
  } catch {
    // silently fail, will try next source
  }

  return results
}

export async function searchBing(query: string): Promise<RawSearchResult[]> {
  const results: RawSearchResult[] = []

  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-BR&cc=BR`
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return results

    const html = await response.text()
    const $ = cheerio.load(html)

    $('li.b_algo').each((_, el) => {
      const titleEl = $(el).find('h2 a')
      const snippetEl = $(el).find('.b_caption p')

      const title = titleEl.text().trim()
      const href = titleEl.attr('href') ?? ''
      const snippet = snippetEl.text().trim()

      if (!title || !href) return

      const phone = extractPhone(snippet)

      results.push({
        title,
        url: href,
        snippet,
        phone,
        address: null,
      })
    })
  } catch {
    // silently fail
  }

  return results
}

export function buildSearchQueries(niche: NicheType, city: string, state: string): string[] {
  const terms = NICHE_SEARCH_TERMS[niche]
  const location = `${city} ${state}`
  const queries: string[] = []

  const primaryTerms = terms.slice(0, 3)
  for (const term of primaryTerms) {
    queries.push(`${term} em ${location}`)
    queries.push(`${term} ${city} telefone endereço`)
  }

  queries.push(`${primaryTerms[0]} perto de mim ${location} instagram`)

  return queries
}

export async function mineByNicheAndRegion(
  niche: NicheType,
  city: string,
  state: string,
  depth: 'rapida' | 'normal' | 'profunda'
): Promise<RawSearchResult[]> {
  const queries = buildSearchQueries(niche, city, state)
  const maxQueries = depth === 'rapida' ? 2 : depth === 'normal' ? 4 : queries.length
  const selectedQueries = queries.slice(0, maxQueries)

  const allResults: RawSearchResult[] = []
  const seenUrls = new Set<string>()

  for (const query of selectedQueries) {
    const ddgResults = await searchDuckDuckGo(query)
    await delay(1500 + Math.random() * 2000)

    if (ddgResults.length === 0) {
      const bingResults = await searchBing(query)
      await delay(1500 + Math.random() * 2000)

      for (const r of bingResults) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url)
          allResults.push(r)
        }
      }
    } else {
      for (const r of ddgResults) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url)
          allResults.push(r)
        }
      }
    }
  }

  return allResults
}
