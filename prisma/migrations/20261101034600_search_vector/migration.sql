-- Tìm kiếm không phân biệt dấu: unaccent + tsvector, cập nhật bằng trigger.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$$ SELECT public.unaccent('public.unaccent', replace(replace($1, 'đ', 'd'), 'Đ', 'D')) $$;

CREATE OR REPLACE FUNCTION article_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', immutable_unaccent(lower(coalesce(NEW."title", '')))), 'A') ||
    setweight(to_tsvector('simple', immutable_unaccent(lower(coalesce(NEW."sapo", '')))), 'B') ||
    setweight(to_tsvector('simple', immutable_unaccent(lower(regexp_replace(coalesce(NEW."contentHtml", ''), '<[^>]+>', ' ', 'g')))), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_search_vector_trg
  BEFORE INSERT OR UPDATE OF "title", "sapo", "contentHtml" ON "Article"
  FOR EACH ROW EXECUTE FUNCTION article_search_vector_update();

CREATE INDEX "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");
