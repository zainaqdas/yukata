import { PostCard } from "@/components/PostCard";

interface PostGridProps {
  posts: Array<{
    id: string;
    title: string;
    type: string;
    thumbnailUrl: string | null;
    publishedAt: Date;
    creatorAccount?: { id: string; name: string } | null;
    media: Array<{
      id: string;
      type: string;
      thumbnailUrl: string | null;
      hlsExpiresAt: Date | null;
      duration: number | null;
    }>;
  }>;
}

export function PostGrid({ posts }: PostGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          title={post.title}
          type={post.type as any}
          thumbnailUrl={post.thumbnailUrl}
          publishedAt={post.publishedAt.toISOString()}
          creatorName={post.creatorAccount?.name}
          media={post.media}
        />
      ))}
    </div>
  );
}
