import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog');

  // Filter posts that have an issueNumber and are not drafts, then sort by issueNumber descending
  const newsletterPosts = posts
    .filter((post) => post.data.issueNumber !== undefined && !post.data.draft)
    .sort((a, b) => {
      const aIssue = a.data.issueNumber ?? 0;
      const bIssue = b.data.issueNumber ?? 0;
      return bIssue - aIssue;
    });

  const baseUrl = site?.href || 'https://chris-hartwig.com';

  const issues = newsletterPosts.map((post) => {
    const issueNumber = post.data.issueNumber!;
    return {
      issueNumber,
      slug: post.slug,
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate.toISOString(),
      author: post.data.author,
      webUrl: `${baseUrl}/blog/${post.slug}/`,
      emailHtmlPath: `/newsletter/email/${issueNumber}/`,
    };
  });

  // Return latest 5 issues, but also include all for lookup
  return new Response(
    JSON.stringify({
      issues,
      latest: issues.slice(0, 5),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};
