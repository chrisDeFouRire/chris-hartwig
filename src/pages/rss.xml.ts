import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog');

  const publishedPosts = posts
    .filter((post) => !post.data.draft)
    .sort((a, b) => {
      const diff = b.data.pubDate.getTime() - a.data.pubDate.getTime();
      if (diff !== 0) return diff;
      return a.slug.localeCompare(b.slug);
    });

  const baseUrl = site?.href || 'https://chris-hartwig.com';
  const siteTitle = 'AI for SWE | Engineering-first newsletter on AI coding';
  const siteDescription = 'Opinionated weekly essays on AI-assisted software engineering: prototyping vs production, security, architecture, tests, maintenance, and the tradeoffs that matter.';

  const rssItems = publishedPosts.map((post) => {
    const postUrl = `${baseUrl}/blog/${post.slug}/`;
    const pubDate = post.data.pubDate.toUTCString();

    return `    <item>
      <title><![CDATA[${post.data.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description><![CDATA[${post.data.description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <author>${post.data.author || 'Chris Hartwig'}</author>
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${siteTitle}]]></title>
    <link>${baseUrl}</link>
    <description><![CDATA[${siteDescription}]]></description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Astro</generator>
${rssItems.join('\n')}
  </channel>
</rss>`;

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

