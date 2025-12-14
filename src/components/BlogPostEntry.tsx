interface BlogPostEntryProps {
  slug: string;
  title: string;
  description: string;
  image?: string;
  pubDate: Date;
  author: string;
  readingTime: number;
}

const BlogPostEntry = ({
  slug,
  title,
  description,
  image,
  pubDate,
  author,
  readingTime,
}: BlogPostEntryProps) => {
  const formattedDate = new Date(pubDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="card overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row">
        {image && (
          <a href={`/blog/${slug}/`} className="md:w-48 md:flex-shrink-0 block">
            <img
              src={image}
              alt={title}
              className="w-full h-48 md:h-full object-cover"
            />
          </a>
        )}
        <div className="px-6 pb-3 pt-0 flex-1">
          <div>
            <h2 className="text-xl font-bold mb-2 mt-6">
              <a href={`/blog/${slug}/`} className="text-gray-900 hover:text-primary">
                {title}
              </a>
            </h2>
            <p className="text-gray-600 mb-4">{description}</p>

            <div className="flex items-center text-sm text-gray-500">
              <span>{formattedDate}</span>
              <span className="mx-2">•</span>
              <span>{readingTime} min read</span>
              <span className="mx-2">•</span>
              <span>By {author}</span>
            </div>
          </div>
          <div className="text-right mt-4">
            <a
              href={`/blog/${slug}/`}
              className="text-primary font-medium inline-block hover:underline"
            >
              Read →
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

export default BlogPostEntry;
