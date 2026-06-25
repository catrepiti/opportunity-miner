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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
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

function decodeBingUrl(bingUrl: string): string {
  try {
    const urlObj = new URL(bingUrl)
    const u = urlObj.searchParams.get('u')
    if (u) {
      const decoded = Buffer.from(u.replace(/^a1/, ''), 'base64').toString('utf-8')
      if (decoded.startsWith('http')) return decoded
    }
  } catch {}
  return bingUrl
}

function cleanUrl(rawUrl: string): string {
  if (rawUrl.includes('bing.com/ck/a')) return decodeBingUrl(rawUrl)
  if (rawUrl.includes('google.com/url')) {
    try {
      const u = new URL(rawUrl)
      return u.searchParams.get('q') ?? u.searchParams.get('url') ?? rawUrl
    } catch {}
  }
  return rawUrl
}

export async function searchDuckDuckGo(query: string): Promise<RawSearchResult[]> {
  const results: RawSearchResult[] = []

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
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
      href = cleanUrl(href)

      const phone = extractPhone(snippet)

      results.push({ title, url: href, snippet, phone, address: null })
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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
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

      results.push({ title, url: cleanUrl(href), snippet, phone, address: null })
    })
  } catch {
    // silently fail
  }

  return results
}

export async function searchGoogle(query: string): Promise<RawSearchResult[]> {
  const results: RawSearchResult[] = []

  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&num=10`
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })

    if (!response.ok) return results

    const html = await response.text()
    const $ = cheerio.load(html)

    $('div.g, div[data-hveid]').each((_, el) => {
      const linkEl = $(el).find('a[href^="http"]').first()
      const titleEl = $(el).find('h3').first()
      const snippetEl = $(el).find('div[data-sncf], div.VwiC3b, span.st, div[style*="-webkit-line-clamp"]').first()

      const href = linkEl.attr('href') ?? ''
      const title = titleEl.text().trim()
      const snippet = snippetEl.text().trim()

      const realUrl = cleanUrl(href)
      if (!title || !realUrl || realUrl.includes('google.com')) return

      const phone = extractPhone(snippet)

      results.push({ title, url: realUrl, snippet, phone, address: null })
    })
  } catch {
    // silently fail
  }

  return results
}

export async function searchDuckDuckGoAPI(query: string): Promise<RawSearchResult[]> {
  const results: RawSearchResult[] = []

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
    const response = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) return results

    const data = await response.json()

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.slice(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text,
            phone: extractPhone(topic.Text),
            address: null,
          })
        }
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (sub.FirstURL && sub.Text) {
              results.push({
                title: sub.Text.slice(0, 100),
                url: sub.FirstURL,
                snippet: sub.Text,
                phone: extractPhone(sub.Text),
                address: null,
              })
            }
          }
        }
      }
    }
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
    let found: RawSearchResult[] = []

    found = await searchGoogle(query)

    if (found.length === 0) {
      await delay(500 + Math.random() * 500)
      found = await searchDuckDuckGo(query)
    }

    if (found.length === 0) {
      await delay(500 + Math.random() * 500)
      found = await searchBing(query)
    }

    for (const r of found) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url)
        allResults.push(r)
      }
    }

    await delay(500 + Math.random() * 500)
  }

  return allResults
}
