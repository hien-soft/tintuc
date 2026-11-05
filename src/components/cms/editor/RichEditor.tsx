"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import { MediaPicker, thumbUrl } from "./MediaPicker";

function ToolButton({ onClick, active, title, children, disabled }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded-full px-2.5 py-1 text-sm font-medium transition-colors ${active ? "bg-brand text-white" : "text-gray-700 hover:bg-white hover:text-brand"} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onPickImages }: { editor: Editor; onPickImages: () => void }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Nhập đường dẫn (để trống để bỏ liên kết):", prev ?? "https://");
    if (url === null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addVideo = () => {
    const url = prompt("Đường dẫn video YouTube:");
    if (url) editor.commands.setYoutubeVideo({ src: url });
  };
  const addRelated = () => {
    const title = prompt("Tiêu đề bài liên quan:");
    if (!title) return;
    const url = prompt("Đường dẫn bài liên quan:", "/vi/");
    if (!url) return;
    editor.chain().focus().insertContent(`<blockquote><p><strong>Tin liên quan:</strong> <a href="${url.replace(/"/g, "")}">${title.replace(/</g, "")}</a></p></blockquote>`).run();
  };
  return (
    <div className="sticky top-[72px] z-10 flex flex-wrap gap-1 rounded-t-lg border-b border-hairline bg-canvas p-1.5">
      <ToolButton title="Đậm" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolButton>
      <ToolButton title="Nghiêng" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolButton>
      <ToolButton title="Tiêu đề H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
      <ToolButton title="Tiêu đề H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
      <ToolButton title="Danh sách" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolButton>
      <ToolButton title="Danh sách số" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolButton>
      <ToolButton title="Trích dẫn" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</ToolButton>
      <ToolButton title="Liên kết" active={editor.isActive("link")} onClick={setLink}>🔗</ToolButton>
      <ToolButton title="Chèn ảnh / gallery" onClick={onPickImages}>🖼 Ảnh</ToolButton>
      <ToolButton title="Chèn video YouTube" onClick={addVideo}>▶ Video</ToolButton>
      <ToolButton title="Chèn bảng" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ Bảng</ToolButton>
      {editor.isActive("table") && (
        <>
          <ToolButton title="Thêm hàng" onClick={() => editor.chain().focus().addRowAfter().run()}>+Hàng</ToolButton>
          <ToolButton title="Thêm cột" onClick={() => editor.chain().focus().addColumnAfter().run()}>+Cột</ToolButton>
          <ToolButton title="Xóa bảng" onClick={() => editor.chain().focus().deleteTable().run()}>×Bảng</ToolButton>
        </>
      )}
      <ToolButton title="Box tin liên quan" onClick={addRelated}>📰 Tin liên quan</ToolButton>
      <ToolButton title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↶</ToolButton>
      <ToolButton title="Làm lại" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↷</ToolButton>
    </div>
  );
}

export function RichEditor({ html, readOnly, onChange }: { html: string; readOnly: boolean; onChange: (html: string, json: JSONContent) => void }) {
  const [picker, setPicker] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
    ],
    content: html,
    editorProps: { attributes: { class: "article-body" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  if (!editor) return <div className="min-h-[420px] animate-pulse bg-gray-50" />;

  return (
    <div className="rounded-lg border border-[#CFD8EA] bg-white focus-within:border-[#0061FC] focus-within:shadow-[0_0_0_4px_rgba(0,97,252,0.14)]">
      {!readOnly && <Toolbar editor={editor} onPickImages={() => setPicker(true)} />}
      <EditorContent editor={editor} />
      <MediaPicker
        open={picker}
        multiple
        onClose={() => setPicker(false)}
        onSelect={(items) => {
          const chain = editor.chain().focus();
          for (const m of items) chain.setImage({ src: thumbUrl(m.key, "stand"), alt: m.alt ?? "", title: m.caption ?? "" });
          chain.run();
        }}
      />
    </div>
  );
}
