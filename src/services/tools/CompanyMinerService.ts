import OpenAI from 'openai';
import { z } from 'zod';
import { search as duckDuckGoSearch, SafeSearchType } from 'duck-duck-scrape';
import config from '../../config';
import logger from '../../utils/logger';

const WEBSITE_FETCH_TIMEOUT_MS = 8000;
const WEBSITE_MAX_CHARS = 10000;
const URL_MAX_LENGTH = 2048;

const BLOCKED_PROTOCOLS = ['file:', 'javascript:', 'data:', 'vbscript:', 'ftp:'];

export interface CompanyMinerResult {
  aboutTheCompany: string;
  products: string[];
  services: string[];
  industry: string;
  top5SourcesOfIncome: string[];
  financialResultsLatest5: string[];
  currentChallenges: string[];
  competitors: string[];
  /** True when financial or income data was filled from public search (not company website). */
  publicSearchUsed?: boolean;
  /** True when about, industry, or financials were filled from Yahoo Finance (listed companies only). */
  yahooFinanceUsed?: boolean;
}

/** Suggested service we can provide to the mined company, with short rationale. */
export interface SuggestedServiceWeCanProvide {
  serviceId?: number;
  serviceName: string;
  rationale: string;
}

const companyMinerResponseSchema = z.object({
  aboutTheCompany: z.string(),
  products: z.array(z.string()),
  services: z.array(z.string()),
  industry: z.string(),
  top5SourcesOfIncome: z.array(z.string()).optional().default([]),
  financialResultsLatest5: z.array(z.string()).optional().default([]),
  currentChallenges: z.array(z.string()).optional().default([]),
  competitors: z.array(z.string()).optional().default([]),
});

export class CompanyMinerService {
  private readonly client: OpenAI | null = null;
  private yahooFinancePromise: Promise<Record<string, unknown>> | null = null;

  private async getYahooFinance(): Promise<Record<string, unknown>> {
    if (!this.yahooFinancePromise) {
      this.yahooFinancePromise = import('yahoo-finance2').then((m: { default: new () => Record<string, unknown> }) => new m.default());
    }
    return this.yahooFinancePromise;
  }

  constructor() {
    if (config.openai?.apiKey?.trim()) {
      this.client = new OpenAI({ apiKey: config.openai.apiKey.trim() });
    }
  }

  /**
   * Validates input and normalizes to a fetchable URL.
   * Accepts: example.com, www.example.com, http(s)://example.com, http(s)://www.example.com.
   * Blocks: file:, javascript:, data:, vbscript:, ftp: and other non-http(s) protocols.
   * @returns Normalized URL (always has https:// or http://)
   */
  normalizeUrl(url: string): string {
    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (!trimmed) {
      throw new Error('URL is required');
    }
    if (trimmed.length > URL_MAX_LENGTH) {
      throw new Error(`URL must be at most ${URL_MAX_LENGTH} characters`);
    }
    const lower = trimmed.toLowerCase();
    for (const protocol of BLOCKED_PROTOCOLS) {
      if (lower.startsWith(protocol)) {
        throw new Error('URL protocol is not allowed');
      }
    }
    let toFetch = trimmed;
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      toFetch = `https://${trimmed}`;
    }
    try {
      const parsed = new URL(toFetch);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('URL must use http or https');
      }
      return toFetch;
    } catch (err) {
      if (err instanceof Error && err.message === 'URL must use http or https') throw err;
      throw new Error('URL is malformed');
    }
  }

  /**
   * Mine company info from a website URL: fetch content, then extract via OpenAI.
   * No cache; no DB. Normalizes URL (accepts domain-only), fetches page, strips HTML, calls OpenAI, returns DTO.
   * When an optional instruction is provided, the AI is asked to prioritize that focus area.
   */
  async mineCompany(url: string, instruction?: string): Promise<CompanyMinerResult> {
    const normalizedUrl = this.normalizeUrl(url);

    const websiteText = await this.fetchWebsiteText(normalizedUrl);
    if (!websiteText || websiteText.length < 100) {
      throw new Error('Could not fetch website content or content was too short to analyze');
    }

    if (!this.client) {
      logger.warn('Company Miner: OpenAI not configured');
      throw new Error('AI extraction is not configured');
    }

    let result = await this.extractWithOpenAI(normalizedUrl, websiteText, instruction);

    const yahooEnriched = await this.enrichFromYahooFinance(normalizedUrl, result);
    if (yahooEnriched) {
      const usedYahooAbout = !result.aboutTheCompany?.trim() && !!yahooEnriched.aboutTheCompany;
      const usedYahooIndustry = !result.industry?.trim() && !!yahooEnriched.industry;
      const usedYahooFinancials =
        result.financialResultsLatest5.length === 0 && (yahooEnriched.financialResultsLatest5?.length ?? 0) > 0;
      result = {
        ...result,
        aboutTheCompany: result.aboutTheCompany?.trim() || yahooEnriched.aboutTheCompany || result.aboutTheCompany,
        industry: result.industry?.trim() || yahooEnriched.industry || result.industry,
        financialResultsLatest5:
          result.financialResultsLatest5.length > 0
            ? result.financialResultsLatest5
            : yahooEnriched.financialResultsLatest5 ?? [],
        yahooFinanceUsed: usedYahooAbout || usedYahooIndustry || usedYahooFinancials,
      };
    }

    const needPublicSearch =
      result.financialResultsLatest5.length === 0 ||
      result.top5SourcesOfIncome.length === 0 ||
      result.currentChallenges.length === 0 ||
      result.competitors.length === 0;
    if (needPublicSearch) {
      const enriched = await this.enrichFromPublicSearch(normalizedUrl, result);
      if (enriched) {
        const filledIncome = enriched.top5SourcesOfIncome.length > 0;
        const filledFinancials = enriched.financialResultsLatest5.length > 0;
        const filledChallenges = enriched.currentChallenges.length > 0;
        const filledCompetitors = enriched.competitors.length > 0;
        result = {
          ...result,
          top5SourcesOfIncome:
            result.top5SourcesOfIncome.length > 0 ? result.top5SourcesOfIncome : enriched.top5SourcesOfIncome,
          financialResultsLatest5:
            result.financialResultsLatest5.length > 0
              ? result.financialResultsLatest5
              : enriched.financialResultsLatest5,
          currentChallenges:
            result.currentChallenges.length > 0 ? result.currentChallenges : enriched.currentChallenges,
          competitors: result.competitors.length > 0 ? result.competitors : enriched.competitors,
          publicSearchUsed:
            result.publicSearchUsed || filledIncome || filledFinancials || filledChallenges || filledCompetitors,
        };
      }
    }

    // Industry-based peer search: whenever we have industry, fetch peer companies in that industry and merge (ensures competitors section is usually populated)
    if (result.industry?.trim() && this.client) {
      const domain = new URL(normalizedUrl).hostname.replace(/^www\./i, '');
      const baseName = domain.split('.')[0] ?? domain;
      const industryPeers = await this.enrichCompetitorsFromIndustrySearch(result.industry.trim());
      const filtered = industryPeers.filter(
        (name) => name.trim().toLowerCase() !== baseName.toLowerCase()
      );
      if (filtered.length > 0) {
        result = {
          ...result,
          competitors: this.mergeCompetitorLists(result.competitors, filtered),
          publicSearchUsed: true,
        };
      }
    }

    // Dedicated competitor search when still none: company-specific queries (e.g. "Acme competitors")
    if (result.competitors.length === 0 && this.client) {
      const dedicatedCompetitors = await this.enrichCompetitorsFromDedicatedSearch(normalizedUrl, result);
      if (dedicatedCompetitors.length > 0) {
        result = {
          ...result,
          competitors: dedicatedCompetitors,
          publicSearchUsed: true,
        };
      }
    }

    return result;
  }

  /**
   * Enrich from Yahoo Finance for listed companies: resolve symbol from name/domain, then fetch
   * summaryProfile/assetProfile (about, industry) and fundamentalsTimeSeries (financials). No API key required.
   */
  private async enrichFromYahooFinance(
    normalizedUrl: string,
    websiteResult: CompanyMinerResult
  ): Promise<{
    aboutTheCompany?: string;
    industry?: string;
    financialResultsLatest5: string[];
  } | null> {
    try {
      const symbol = await this.resolveSymbolFromUrl(normalizedUrl, websiteResult);
      if (!symbol) return null;

      const yahoo = await this.getYahooFinance();
      const [summary, financials] = await Promise.all([
        (yahoo.quoteSummary as (s: string, o: unknown) => Promise<unknown>)(symbol, {
          modules: ['summaryProfile', 'assetProfile'],
        }),
        this.fetchYahooFinancialsTimeSeries(symbol),
      ]);

      const s = summary as Record<string, unknown> | null | undefined;
      const summaryProfile = s?.summaryProfile as { longBusinessSummary?: string; industry?: string; sector?: string } | undefined;
      const assetProfile = s?.assetProfile as { longBusinessSummary?: string; description?: string; industry?: string; sector?: string } | undefined;
      const aboutTheCompany =
        summaryProfile?.longBusinessSummary?.trim() ||
        assetProfile?.longBusinessSummary?.trim() ||
        assetProfile?.description?.trim();
      const industry =
        summaryProfile?.industry?.trim() ||
        summaryProfile?.sector?.trim() ||
        assetProfile?.industry?.trim() ||
        assetProfile?.sector?.trim();

      const financialResultsLatest5 = financials ?? [];

      if (!aboutTheCompany && !industry && financialResultsLatest5.length === 0) return null;

      return {
        ...(aboutTheCompany && { aboutTheCompany }),
        ...(industry && { industry }),
        financialResultsLatest5,
      };
    } catch (err) {
      logger.warn('Company Miner: Yahoo Finance enrichment failed', { error: err });
      return null;
    }
  }

  private async resolveSymbolFromUrl(
    normalizedUrl: string,
    websiteResult: CompanyMinerResult
  ): Promise<string | null> {
    const domain = new URL(normalizedUrl).hostname.replace(/^www\./i, '');
    const baseName = domain.split('.')[0] ?? domain;
    const searchQueries = [
      baseName,
      baseName.replace(/^([a-z])/, (_, c: string) => c.toUpperCase()),
      websiteResult.aboutTheCompany?.slice(0, 50).trim() || baseName,
    ].filter(Boolean);
    for (const q of searchQueries) {
      if (!q || q.length < 2) continue;
      try {
        const yahoo = await this.getYahooFinance();
        const searchResult = await (yahoo.search as (q: string, o?: unknown) => Promise<{ quotes?: unknown[] }>)(q, { quotesCount: 5 });
        const quotes = searchResult?.quotes ?? [];
        const equity = quotes.find((quote: unknown) => {
          const q = quote as { quoteType?: string; symbol?: string };
          return q && typeof q.symbol === 'string' && q.quoteType === 'EQUITY';
        }) as { symbol: string } | undefined;
        if (equity?.symbol) return equity.symbol;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async fetchYahooFinancialsTimeSeries(symbol: string): Promise<string[]> {
    try {
      const period1 = new Date();
      period1.setFullYear(period1.getFullYear() - 6);
      const yahoo = await this.getYahooFinance();
      const data = await (yahoo.fundamentalsTimeSeries as (s: string, o: unknown) => Promise<unknown>)(symbol, {
        period1: period1.toISOString().slice(0, 10),
        type: 'annual',
        module: 'financials',
      });
      if (!Array.isArray(data) || data.length === 0) return [];
      const sorted = [...data].sort((a, b) => {
        const da = (a as { date?: Date }).date?.getTime() ?? 0;
        const db = (b as { date?: Date }).date?.getTime() ?? 0;
        return db - da;
      });
      const out: string[] = [];
      for (const item of sorted.slice(0, 5)) {
        const row = item as { date?: Date; totalRevenue?: number; netIncome?: number };
        const year = row.date?.getFullYear();
        if (year == null) continue;
        const rev = row.totalRevenue;
        const net = row.netIncome;
        const parts = [`FY${year}`];
        if (typeof rev === 'number') parts.push(`Revenue ${this.formatYahooNumber(rev)}`);
        if (typeof net === 'number') parts.push(`Net income ${this.formatYahooNumber(net)}`);
        if (parts.length > 1) out.push(parts.join(': '));
      }
      return out;
    } catch (err) {
      logger.warn('Company Miner: Yahoo fundamentalsTimeSeries failed', { symbol, error: err });
      return [];
    }
  }

  private formatYahooNumber(n: number): string {
    if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    return String(n);
  }

  /**
   * Search public web (DuckDuckGo via duck-duck-scrape) for company financials/segments/challenges/competitors and extract via OpenAI.
   * Used when website did not yield financial results, income sources, challenges, or competitors. No API key required.
   */
  private async enrichFromPublicSearch(
    normalizedUrl: string,
    _websiteResult: CompanyMinerResult
  ): Promise<{
    top5SourcesOfIncome: string[];
    financialResultsLatest5: string[];
    currentChallenges: string[];
    competitors: string[];
  } | null> {
    try {
      const domain = new URL(normalizedUrl).hostname.replace(/^www\./i, '');
      const query = `${domain} financial results revenue profit PAT segments challenges risks issues headwinds competitors competition peers`;
      const searchText = await this.fetchSearchSnippets(query);
      if (!searchText || searchText.length < 50) return null;
      return await this.extractFinancialsFromText(searchText);
    } catch (err) {
      logger.warn('Company Miner: public search enrichment failed', { error: err });
      return null;
    }
  }

  private async fetchSearchSnippets(query: string, maxResults: number = 10): Promise<string | null> {
    try {
      const searchResults = await duckDuckGoSearch(query.slice(0, 500), {
        safeSearch: SafeSearchType.STRICT,
      });
      if (searchResults.noResults || !searchResults.results?.length) return null;
      const snippets = searchResults.results
        .slice(0, maxResults)
        .map((r) => [r.title, r.description || r.rawDescription].filter(Boolean).join(': '))
        .filter(Boolean);
      return snippets.length > 0 ? snippets.join('\n\n') : null;
    } catch (err) {
      logger.warn('Company Miner: DuckDuckGo search failed', { error: err });
      return null;
    }
  }

  private readonly publicSearchExtractSchema = z.object({
    top5SourcesOfIncome: z.array(z.string()).optional().default([]),
    financialResultsLatest5: z.array(z.string()).optional().default([]),
    currentChallenges: z.array(z.string()).optional().default([]),
    competitors: z.array(z.string()).optional().default([]),
  });

  private async extractFinancialsFromText(
    text: string
  ): Promise<{
    top5SourcesOfIncome: string[];
    financialResultsLatest5: string[];
    currentChallenges: string[];
    competitors: string[];
  }> {
    if (!this.client) {
      return { top5SourcesOfIncome: [], financialResultsLatest5: [], currentChallenges: [], competitors: [] };
    }
    const systemPrompt = `You are a financial data extractor. Given text from web search results about a company, output valid JSON only with four keys:
1. "top5SourcesOfIncome": array of up to 5 revenue/income sources (segments, product lines, regions). Short strings. If none found, return [].
2. "financialResultsLatest5": array of up to 5 financial facts (revenue, profit/PAT, margins, CAGR, YoY). One string per fact, e.g. "FY2025: Revenue Rs X cr, PAT Y cr". Use exact numbers and currency from the text. If none found, return [].
3. "currentChallenges": array of up to 5 short strings describing current business challenges, risks, headwinds, or constraints that are explicitly mentioned or very clearly implied in the text (for example: "regulatory investigation in EU", "margin pressure from raw material inflation", "slowdown in key export markets"). Do NOT speculate or invent; if the text does not clearly describe any challenges, return [].
4. "competitors": array of up to 10 company names that appear in the text in a competitive or peer context (e.g. "competitors of X", "X vs Y", "alternatives to X", "companies like X", "top competitors", "main rivals", or lists of companies in the same sector). Include any company names that appear in such contexts; only omit if the text has no competitor/peer mentions at all.

Output only a JSON object with keys top5SourcesOfIncome, financialResultsLatest5, currentChallenges, and competitors. No markdown, no code block.`;

    const userPrompt = `Extract from this text:\n${text.slice(0, 8000)}`;
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw)
        return {
          top5SourcesOfIncome: [],
          financialResultsLatest5: [],
          currentChallenges: [],
          competitors: [],
        };
      let jsonStr = raw;
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
      const parsed = this.publicSearchExtractSchema.parse(JSON.parse(jsonStr));
      return {
        top5SourcesOfIncome: (parsed.top5SourcesOfIncome ?? []).slice(0, 5),
        financialResultsLatest5: (parsed.financialResultsLatest5 ?? []).slice(0, 5),
        currentChallenges: (parsed.currentChallenges ?? []).slice(0, 5),
        competitors: (parsed.competitors ?? []).slice(0, 10),
      };
    } catch {
      return { top5SourcesOfIncome: [], financialResultsLatest5: [], currentChallenges: [], competitors: [] };
    }
  }

  /**
   * Run competitor-focused web searches and extract competitor names with a more inclusive prompt.
   * Used when the main public search did not yield any competitors.
   */
  private async enrichCompetitorsFromDedicatedSearch(
    normalizedUrl: string,
    result: CompanyMinerResult
  ): Promise<string[]> {
    const domain = new URL(normalizedUrl).hostname.replace(/^www\./i, '');
    const baseName = domain.split('.')[0] ?? domain;
    const companyHint = result.aboutTheCompany?.slice(0, 80).trim() || baseName;
    const queries = [
      `${baseName} competitors`,
      `${domain} competitors alternatives`,
      `${companyHint} competitors list`,
    ];
    const allSnippets: string[] = [];
    for (const q of queries) {
      const text = await this.fetchSearchSnippets(q.slice(0, 500));
      if (text && text.length >= 30) allSnippets.push(text);
    }
    if (allSnippets.length === 0) return [];
    const combined = allSnippets.join('\n\n');
    return this.extractCompetitorsFromText(combined, 'competitor');
  }

  /** Merge two competitor lists, dedupe case-insensitively, cap at 10. */
  private mergeCompetitorLists(existing: string[], toAdd: string[]): string[] {
    const seen = new Set(existing.map((n) => n.trim().toLowerCase()));
    const out = [...existing];
    for (const name of toAdd) {
      const n = name.trim();
      if (!n) continue;
      const key = n.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(n);
      }
      if (out.length >= 10) break;
    }
    return out.slice(0, 10);
  }

  /**
   * Run industry-focused search and extract company names that are peer companies in that industry.
   * Uses multiple query shapes to improve chance of results.
   */
  private async enrichCompetitorsFromIndustrySearch(industry: string): Promise<string[]> {
    const queries = [
      `top companies in ${industry}`,
      `leading ${industry} companies list`,
      `${industry} industry major players`,
      `${industry} sector companies`,
    ];
    const allSnippets: string[] = [];
    for (const q of queries) {
      const text = await this.fetchSearchSnippets(q.slice(0, 500), 15);
      if (text && text.length >= 20) allSnippets.push(text);
    }
    if (allSnippets.length === 0) return [];
    const combined = allSnippets.join('\n\n');
    return this.extractCompetitorsFromText(combined, 'industry', industry);
  }

  private readonly competitorsOnlySchema = z.object({
    competitors: z.array(z.string()).optional().default([]),
  });

  /**
   * Extract competitor/peer company names from text.
   * mode: 'competitor' = text about a specific company's competitors; 'industry' = text about companies in an industry (optionally pass industry name for clearer prompt).
   */
  private async extractCompetitorsFromText(
    text: string,
    mode: 'competitor' | 'industry',
    industryName?: string
  ): Promise<string[]> {
    if (!this.client) return [];
    const industryHint =
      mode === 'industry' && industryName
        ? ` Focus on companies that operate in or serve the "${industryName}" industry.`
        : '';
    const systemPrompt =
      mode === 'competitor'
        ? `You are a competitor extractor. Given text from web search results about a company, extract up to 10 company names that are presented as competitors, alternatives, peers, or rivals. Include names from phrases like "competitors of X", "X vs Y", "alternatives to X", "companies like X", "top competitors", "main rivals", or any list of companies in the same industry/segment. Return only company names that appear in the text; do not invent. Output valid JSON only: {"competitors": ["Name1", "Name2", ...]}. No markdown, no code block.`
        : `You are an industry analyst. Given text about companies in an industry (e.g. lists like "top companies in X", "leading X companies", "X market players"), extract up to 10 company names that are mentioned as operating in or serving that industry.${industryHint} Return only company names that actually appear in the text; do not invent. Output valid JSON only: {"competitors": ["Name1", "Name2", ...]}. No markdown, no code block.`;
    const userPrompt = `Extract peer/competitor company names from this text:\n${text.slice(0, 8000)}`;
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 512,
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) return [];
      let jsonStr = raw;
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
      const parsed = this.competitorsOnlySchema.parse(JSON.parse(jsonStr));
      const list = (parsed.competitors ?? []).filter((s) => typeof s === 'string' && s.trim().length > 0);
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const name of list.slice(0, 10)) {
        const n = name.trim();
        const key = n.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(n);
        }
      }
      return deduped;
    } catch (err) {
      logger.warn('Company Miner: competitor extraction failed', { mode, error: err });
      return [];
    }
  }

  /**
   * Fetch main page or /about from company website, strip HTML, truncate.
   * Tries base URL first, then /about, then /about-us.
   */
  private async fetchWebsiteText(websiteUrl: string): Promise<string | null> {
    const base = websiteUrl.replace(/\/$/, '');
    const urlsToTry = [base, `${base}/about`, `${base}/about-us`];
    for (const url of urlsToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'CompanyMiner/1.0 (B2B company intelligence)' },
          redirect: 'follow',
        });
        clearTimeout(timeout);
        if (!res.ok || !res.headers.get('content-type')?.toLowerCase().includes('text/html')) {
          continue;
        }
        const html = await res.text();
        const text = this.stripHtmlAndTruncate(html, WEBSITE_MAX_CHARS);
        if (text.length >= 100) {
          return text;
        }
      } catch {
        // try next URL
      }
    }
    return null;
  }

  private stripHtmlAndTruncate(html: string, maxChars: number): string {
    const stripped = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.slice(0, maxChars);
  }

  private async extractWithOpenAI(
    url: string,
    websiteText: string,
    instruction?: string
  ): Promise<CompanyMinerResult> {
    const systemPrompt = `You are a company intelligence assistant. Given raw text extracted from a company website, output exactly eight things in valid JSON only.

When an additional user instruction is provided, you must still populate all required fields, but you should prioritize that instruction when deciding which products, services, challenges, financials, and competitors to emphasize. Never ignore the instruction; treat it as a focus filter on what matters most for this analysis.

You must always be strictly grounded in the provided website text (and any enrichment the caller passes you). Do not hallucinate or invent facts that are not clearly supported by the text.:
1. "aboutTheCompany": a clear 2-5 sentence summary of what the company does, who they serve, and their main value proposition. Use only information present in the text; do not invent.
2. "products": an array of product names or product categories the company offers (e.g. ["Product A", "Platform B"]). Use short strings. If none found, return [].
3. "services": an array of services the company offers. Include explicitly listed services (e.g. Consulting, Support, Maintenance). When the site does not have a dedicated "Services" section, still infer service-like offerings from the text when present or strongly implied (e.g. B2B/Bulk supply, Export, Distribution, Private label, Custom solutions, Retail, Sourcing, Logistics). Use short strings. Only return [] when there is truly no mention or implication of any service offering.
4. "industry": a single string for the primary industry or sector (e.g. "Technology", "Healthcare"). If unclear, give the best guess from the text.
5. "top5SourcesOfIncome": an array of up to 5 main revenue or income sources (e.g. product lines, business segments, geographic regions, key clients). Use short descriptive strings. If the text does not mention revenue sources or segment breakdown, return [].
6. "financialResultsLatest5": an array of up to 5 most recent financial results. For each item include whatever the site publishes: revenue, profit (PAT / net profit / PBT), margins (operating margin, net margin), growth (CAGR, YoY), EBITDA, or other key metrics. Prefer one string per period (e.g. "FY2025: Revenue Rs X cr, PAT Rs Y cr, Margin Z%") or one per headline metric if reported separately (e.g. "5-year Revenue CAGR 16%", "PAT CAGR 21%"). Use the exact currency and units from the text (crores, $, %). Most recent or most salient first. If the website does not publish financials, return [].
7. "currentChallenges": an array of up to 5 short strings describing current business challenges, risks, headwinds, or constraints that are explicitly mentioned or very clearly implied in the website text (for example: "regulatory investigation in EU", "margin pressure from raw material inflation", "slowdown in key export markets"). Do NOT speculate or invent. If the text does not clearly describe any such challenges, return [].
8. "competitors": an array of up to 10 company names that operate in the same or very similar industry/segment and that the website text clearly presents as competitors, alternative providers, peers, or comparison points (for example, listing competitor logos or explicit comparisons like "Unlike Competitor A..."). Only include companies that are actually mentioned in the text and clearly positioned as comparable companies. Do NOT guess or infer purely from market knowledge; if the text does not clearly mention competitors or peers, return [].

Output only a single JSON object with keys: aboutTheCompany, products, services, industry, top5SourcesOfIncome, financialResultsLatest5, currentChallenges, competitors. No markdown, no code block, no extra text.`;

    const trimmedInstruction = instruction?.trim();
    const focusText = trimmedInstruction
      ? `\n\nUser focus instruction (prioritize this in your analysis, while still returning all required fields):\n"${trimmedInstruction}"`
      : '';

    const userPrompt = `Website URL: ${url}\n\nWebsite text (extract from this):\n${websiteText.slice(
      0,
      12000
    )}${focusText}`;

    try {
      const completion = await this.client!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1536,
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        throw new Error('AI returned no content');
      }

      // Strip optional markdown code fence for robustness
      let jsonStr = raw;
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr) as unknown;
      const validated = companyMinerResponseSchema.parse(parsed);

      return {
        aboutTheCompany: validated.aboutTheCompany,
        products: validated.products,
        services: validated.services,
        industry: validated.industry,
        top5SourcesOfIncome: Array.isArray(validated.top5SourcesOfIncome)
          ? validated.top5SourcesOfIncome.slice(0, 5)
          : [],
        financialResultsLatest5: Array.isArray(validated.financialResultsLatest5)
          ? validated.financialResultsLatest5.slice(0, 5)
          : [],
        currentChallenges: Array.isArray(validated.currentChallenges)
          ? validated.currentChallenges.slice(0, 5)
          : [],
        competitors: Array.isArray(validated.competitors) ? validated.competitors.slice(0, 10) : [],
      };
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger.warn('Company Miner: OpenAI response failed Zod validation', { errors: err.errors });
        throw new Error('AI extraction returned invalid structure');
      }
      if (err instanceof SyntaxError) {
        logger.warn('Company Miner: OpenAI response was not valid JSON', { error: err });
        throw new Error('AI extraction returned invalid response');
      }
      if (err instanceof Error && err.message.startsWith('AI ')) {
        throw err;
      }
      logger.warn('Company Miner: OpenAI call failed', { error: err });
      throw new Error('AI extraction failed');
    }
  }

  /**
   * Suggest up to 5 services we can provide to help the mined company grow.
   * Uses OpenAI with company profile + our master service list. Returns empty array on failure.
   */
  async suggestServicesWeCanProvide(
    minedResult: CompanyMinerResult,
    masterServices: { id: number; name: string }[]
  ): Promise<SuggestedServiceWeCanProvide[]> {
    if (!this.client || masterServices.length === 0) return [];

    const companySummary = [
      minedResult.aboutTheCompany && `About: ${minedResult.aboutTheCompany}`,
      minedResult.industry && `Industry: ${minedResult.industry}`,
      minedResult.products?.length && `Products: ${minedResult.products.join('; ')}`,
      minedResult.services?.length && `Their services: ${minedResult.services.join('; ')}`,
      minedResult.currentChallenges?.length &&
        `Challenges: ${minedResult.currentChallenges.join('; ')}`,
      minedResult.competitors?.length && `Competitors: ${minedResult.competitors.join(', ')}`,
      minedResult.financialResultsLatest5?.length &&
        `Financials: ${minedResult.financialResultsLatest5.join('; ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const ourServicesList = masterServices.map((s) => s.name).join('\n');

    const systemPrompt = `You are a business development advisor for a software and digital services company. Given a company profile and our list of services we offer, suggest up to 5 services we can provide to help this company grow. For each suggestion:
1. Pick exactly one service from our list (use the exact name as given).
2. Write a short rationale (1-2 sentences) on how we can help them - e.g. building an app, cloud migration, cybersecurity, digital marketing, etc. Base this on their industry, challenges, products, or gaps. Be specific and actionable.

Output valid JSON only: an array of objects with keys "serviceName" (string, must be exactly from our list) and "rationale" (string). Maximum 5 items. If no good fit, return []. No markdown, no code block.`;

    const userPrompt = `Our services we offer (choose only from this list):\n${ourServicesList}\n\nCompany profile:\n${companySummary.slice(0, 4000)}\n\nSuggest up to 5 services we can provide to help this company grow, with a short rationale for each.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) return [];
      let jsonStr = raw;
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr) as unknown;
      const items = Array.isArray(parsed) ? parsed : [];
      const nameToId = new Map(masterServices.map((s) => [s.name.trim().toLowerCase(), s.id]));
      const result: SuggestedServiceWeCanProvide[] = [];
      const seen = new Set<string>();
      for (const item of items.slice(0, 5)) {
        const name = typeof item?.serviceName === 'string' ? item.serviceName.trim() : '';
        const rationale = typeof item?.rationale === 'string' ? item.rationale.trim() : '';
        if (!name || !rationale) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const serviceId = nameToId.get(key);
        result.push({
          serviceId,
          serviceName: name,
          rationale,
        });
      }
      return result;
    } catch (err) {
      logger.warn('Company Miner: suggest services failed', { error: err });
      return [];
    }
  }
}

const companyMinerService = new CompanyMinerService();
export default companyMinerService;
