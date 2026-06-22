import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListComments,
  useCreateComment,
  getListCommentsQueryKey,
  type Comment,
  type MediaType,
} from "@workspace/api-client-react";
import { MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useActiveGroup } from "@/components/active-group-context";
import { ReactionBar } from "@/components/reaction-bar";
import { useReactionMap, reactionKey } from "@/hooks/use-reactions";

export function CommentThread({
  title,
  mediaType,
}: {
  title: string;
  mediaType: MediaType;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeGroupId } = useActiveGroup();

  const params = {
    title,
    mediaType,
    ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
  };

  const { data: comments, isLoading } = useListComments(params, {
    query: { queryKey: getListCommentsQueryKey(params) },
  });

  const create = useCreateComment();
  const reactionMap = useReactionMap();
  const [newBody, setNewBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/comments"] });

  const onError = () =>
    toast({
      variant: "destructive",
      title: "Error",
      description: "Could not post your comment. Please try again.",
    });

  const post = (body: string, parentId: number | null, after: () => void) => {
    const trimmed = body.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(
      {
        data: {
          title,
          mediaType,
          body: trimmed,
          ...(parentId != null ? { parentId } : {}),
          ...(activeGroupId != null ? { groupId: activeGroupId } : {}),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          after();
        },
        onError,
      },
    );
  };

  // Build the reply tree from the flat, oldest-first list.
  const childrenOf = new Map<number, Comment[]>();
  const roots: Comment[] = [];
  for (const c of comments ?? []) {
    if (c.parentId == null) {
      roots.push(c);
    } else {
      const arr = childrenOf.get(c.parentId) ?? [];
      arr.push(c);
      childrenOf.set(c.parentId, arr);
    }
  }

  const renderComment = (c: Comment, depth: number) => {
    const replies = childrenOf.get(c.id) ?? [];
    return (
      <div
        key={c.id}
        className={
          depth > 0 ? "mt-3 ml-3 border-l border-border pl-3" : "mt-4"
        }
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-sm font-semibold text-foreground"
            data-testid={`text-comment-author-${c.id}`}
          >
            {c.authorName}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {format(new Date(c.createdAt), "MMM d, yyyy")}
          </span>
        </div>
        <p
          className="mt-1 text-base leading-relaxed text-foreground whitespace-pre-wrap"
          data-testid={`text-comment-body-${c.id}`}
        >
          {c.body}
        </p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <ReactionBar
            targetType="comment"
            targetId={c.id}
            summary={reactionMap.get(reactionKey("comment", c.id))}
            size="sm"
          />
          <button
            type="button"
            onClick={() => {
              setReplyingTo(replyingTo === c.id ? null : c.id);
              setReplyBody("");
            }}
            className="text-xs font-medium text-primary hover:text-primary/80"
            data-testid={`button-reply-${c.id}`}
          >
            {replyingTo === c.id ? "Cancel" : "Reply"}
          </button>
        </div>

        {replyingTo === c.id && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder={`Reply to ${c.authorName}...`}
              rows={2}
              data-testid={`input-reply-${c.id}`}
            />
            <Button
              size="sm"
              disabled={!replyBody.trim() || create.isPending}
              onClick={() =>
                post(replyBody, c.id, () => {
                  setReplyBody("");
                  setReplyingTo(null);
                })
              }
              data-testid={`button-submit-reply-${c.id}`}
            >
              Reply
            </Button>
          </div>
        )}

        {replies.map((r) => renderComment(r, depth + 1))}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
          Discussion
        </span>
      </div>

      <div className="space-y-2">
        <Textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Share your thoughts with the group..."
          rows={3}
          data-testid="input-new-comment"
        />
        <Button
          disabled={!newBody.trim() || create.isPending}
          onClick={() => post(newBody, null, () => setNewBody(""))}
          data-testid="button-submit-comment"
        >
          Post Comment
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading discussion…</p>
        ) : roots.length === 0 ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="text-no-comments"
          >
            No comments yet — start the conversation.
          </p>
        ) : (
          roots.map((c) => renderComment(c, 0))
        )}
      </div>
    </div>
  );
}
