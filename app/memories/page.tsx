function CommentsSection({
  memoryId,
}: {
  memoryId: string;
}) {
  const memoryComments =
    getMemoryComments(memoryId);

  return (
    <div className="mt-12 border-t border-[#e8f0f3] pt-9">
      {/* COMMENTS TITLE */}

      <div className="text-center">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-[#a8bbc3]">
          COMMENTS
        </p>

        <h3 className="mt-2 text-sm font-semibold text-[#665c58]">
          우리들의 이야기
        </h3>
      </div>

      {/* EMPTY */}

      {memoryComments.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-2xl opacity-70">
            💬
          </div>

          <p className="mt-3 text-sm font-medium text-[#8b9fa9]">
            아직 댓글이 없어요
          </p>

          <p className="mt-1 text-xs text-[#b2c0c6]">
            우리의 첫 번째 댓글을 남겨보세요
            <span className="ml-1">♡</span>
          </p>
        </div>
      ) : (
        /* COMMENTS LIST */

        <div className="mt-6 space-y-4">
          {memoryComments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-2xl bg-[#f8fcfe] px-5 py-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#587582]">
                    {getAuthorName(
                      comment.created_by
                    )}
                  </span>

                  <span className="text-[10px] text-[#b0bec4]">
                    {formatDate(
                      comment.created_at
                    )}
                  </span>
                </div>

                {comment.created_by === myUserId && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteComment(comment)
                    }
                    className="text-[10px] text-[#b8aaa6] transition hover:text-red-400"
                  >
                    삭제
                  </button>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#554b47]">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* COMMENT INPUT */}

      <div className="mt-7">
        <CommentInput
          value={commentText}
          onChange={setCommentText}
          onSubmit={saveComment}
          saving={commentSaving}
        />

        <p className="mt-2 text-center text-[10px] text-[#b1bec4]">
          Enter로 등록 · Shift + Enter로 줄바꿈
        </p>
      </div>
    </div>
  );
}
