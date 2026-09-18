/**
 * Web Search & Live Internet Access Tool for January AI
 * Queries DuckDuckGo API/HTML and Wikipedia for real-time live internet information,
 * news, weather, documentation, and live website fetching with zero API key requirement.
 */

export interface WebSearchResult {
  success: boolean;
  query: string;
  results: Array<{
    title: string;
    snippet: string;
    url: string;
  }>;
  summary?: string;
  error?: string;
}

export interface WebPageContentResult {
  success: boolean;
  url: string;
  title?: string;
  content?: string;
  error?: string;
}

/**
 * Fetches real-time live weather information for any city or location worldwide
 */
export async function fetchLiveWeather(location: string): Promise<WebSearchResult> {
  const cleanLoc = location.trim();
  console.log(`[WebSearch] Fetching live weather for: "${cleanLoc}"...`);

  // 1. Try wttr.in JSON API
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(cleanLoc)}?format=j1`, {
      headers: { 'User-Agent': 'curl/7.88.1' },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      const current = data.current_condition?.[0];
      const nearest = data.nearest_area?.[0];
      const areaName = nearest?.areaName?.[0]?.value || cleanLoc;
      const region = nearest?.region?.[0]?.value || '';
      const country = nearest?.country?.[0]?.value || '';

      if (current) {
        const tempC = current.temp_C;
        const feelsLikeC = current.FeelsLikeC;
        const desc = current.weatherDesc?.[0]?.value || 'Clear';
        const humidity = current.humidity;
        const windKmph = current.windspeedKmph;
        const windDir = current.winddir16Point;
        const uv = current.uvIndex;
        const precipMM = current.precipMM;

        const summary = `Current weather in ${areaName}${region ? ', ' + region : ''}${country ? ', ' + country : ''}: ${desc}, Temperature: ${tempC}°C (Feels like ${feelsLikeC}°C), Humidity: ${humidity}%, Wind: ${windKmph} km/h (${windDir}), UV Index: ${uv}, Precipitation: ${precipMM} mm.`;

        return {
          success: true,
          query: location,
          results: [
            {
              title: `Live Weather for ${areaName}`,
              snippet: summary,
              url: `https://wttr.in/${encodeURIComponent(cleanLoc)}`,
            },
          ],
          summary,
        };
      }
    }
  } catch (e: any) {
    console.warn('[WebSearch] wttr.in JSON notice:', e.message);
  }

  // 2. Try wttr.in plain text format
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(cleanLoc)}?format=%l:+%C+%t+(feels+like+%f),+Humidity:+%h,+Wind:+%w`, {
      headers: { 'User-Agent': 'curl/7.88.1' },
    });
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text && !text.includes('Unknown location')) {
        return {
          success: true,
          query: location,
          results: [
            {
              title: `Weather in ${cleanLoc}`,
              snippet: text,
              url: `https://wttr.in/${encodeURIComponent(cleanLoc)}`,
            },
          ],
          summary: text,
        };
      }
    }
  } catch (e: any) {
    console.warn('[WebSearch] wttr.in text notice:', e.message);
  }

  // 3. Fallback to Open-Meteo API
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanLoc)}&count=1&language=en&format=json`);
    if (geoRes.ok) {
      const geoData = (await geoRes.json()) as any;
      const place = geoData.results?.[0];
      if (place) {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true`);
        if (weatherRes.ok) {
          const wData = (await weatherRes.json()) as any;
          const cw = wData.current_weather;
          if (cw) {
            const summary = `Current weather in ${place.name}, ${place.country || ''}: Temperature: ${cw.temperature}°C, Wind Speed: ${cw.windspeed} km/h, Wind Direction: ${cw.winddirection}°.`;
            return {
              success: true,
              query: location,
              results: [
                {
                  title: `Weather for ${place.name}`,
                  snippet: summary,
                  url: `https://open-meteo.com`,
                },
              ],
              summary,
            };
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('[WebSearch] Open-Meteo notice:', e.message);
  }

  return {
    success: false,
    query: location,
    results: [],
    error: `Could not retrieve live weather for ${location}.`,
  };
}

/**
 * Searches the web in real-time using open internet search APIs
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  if (!query || !query.trim()) {
    return {
      success: false,
      query: '',
      results: [],
      error: 'Query parameter cannot be empty.',
    };
  }

  const cleanQuery = query.trim();

  // If query is about weather, route directly to live weather resolver
  if (/\b(weather|temperature|forecast|climate|how\s*is\s*the\s*weather|whats\s*the\s*weather)\b/i.test(cleanQuery)) {
    const loc = cleanQuery
      .replace(/\b(whats|what is|how is|hows|tell me|show me|check|the|current|live|today|todays|in|for|at|weather|temperature|forecast|climate|of)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || cleanQuery;
    const weatherResult = await fetchLiveWeather(loc);
    if (weatherResult.success) {
      return weatherResult;
    }
  }

  console.log(`[WebSearch] Searching live internet for: "${cleanQuery}"...`);

  const results: Array<{ title: string; snippet: string; url: string }> = [];
  let summary = '';

  // 1. Try DuckDuckGo Instant Answer API
  try {
    const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data.AbstractText) {
        summary = data.AbstractText;
        results.push({
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL || 'https://duckduckgo.com',
        });
      }

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 4)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Result',
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }
    }
  } catch (e: any) {
    console.warn('[WebSearch] DuckDuckGo Instant API notice:', e.message);
  }

  // 2. Try DuckDuckGo HTML search for comprehensive web links if needed
  if (results.length < 2) {
    try {
      const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (res.ok) {
        const html = await res.text();
        // Extract results from HTML
        const resultRegex = /<a class="result__snippet[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>|<a class="result__url"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
        const linkTitleRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

        let match;
        const linkMatches: Array<{ url: string; title: string }> = [];
        while ((match = linkTitleRegex.exec(html)) !== null && linkMatches.length < 5) {
          const rawUrl = match[1];
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          // Extract actual URL from DuckDuckGo redirect
          const urlMatch = rawUrl.match(/uddg=([^&]+)/);
          const actualUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
          if (title && actualUrl.startsWith('http')) {
            linkMatches.push({ url: actualUrl, title });
          }
        }

        const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
        let sMatch;
        let sIdx = 0;
        while ((sMatch = snippetRegex.exec(html)) !== null && sIdx < linkMatches.length) {
          const snippet = sMatch[1].replace(/<[^>]+>/g, '').trim();
          results.push({
            title: linkMatches[sIdx].title,
            snippet,
            url: linkMatches[sIdx].url,
          });
          sIdx++;
        }
      }
    } catch (e: any) {
      console.warn('[WebSearch] DuckDuckGo HTML search notice:', e.message);
    }
  }

  // 3. Try Wikipedia API for factual / encyclopedic knowledge
  if (results.length === 0) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&utf8=1`;
      const res = await fetch(wikiUrl);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.query?.search && Array.isArray(data.query.search)) {
          for (const item of data.query.search.slice(0, 3)) {
            const cleanSnippet = (item.snippet || '').replace(/<[^>]+>/g, '');
            results.push({
              title: item.title,
              snippet: cleanSnippet,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
            });
          }
        }
      }
    } catch (e: any) {
      console.warn('[WebSearch] Wikipedia search notice:', e.message);
    }
  }

  return {
    success: results.length > 0,
    query: cleanQuery,
    results: results.slice(0, 5),
    summary: summary || (results[0] ? results[0].snippet : undefined),
    error: results.length === 0 ? 'No internet search results found for the query.' : undefined,
  };
}

/**
 * Fetches and reads text content from a given URL
 */
export async function fetchWebPage(url: string): Promise<WebPageContentResult> {
  if (!url || !url.startsWith('http')) {
    return {
      success: false,
      url: url || '',
      error: 'Invalid or missing URL. URL must start with http:// or https://',
    };
  }

  console.log(`[WebFetch] Fetching live webpage content: ${url}...`);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return {
        success: false,
        url,
        error: `HTTP Error: ${res.status} ${res.statusText}`,
      };
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Strip scripts, styles, and extract main body text
    const cleanContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000); // Limit to 3,000 characters for token efficiency

    return {
      success: true,
      url,
      title,
      content: cleanContent,
    };
  } catch (e: any) {
    return {
      success: false,
      url,
      error: `Failed to fetch page: ${e.message}`,
    };
  }
}
