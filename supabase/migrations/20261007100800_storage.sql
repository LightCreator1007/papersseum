-- Storage buckets for agent code and replays.


-- agents: private. No storage policies, so only the secret key (API route,
-- worker) can read or write. Not even the uploader can download their file.
-- replays: public read through the bucket's public URL; only the secret key
-- can upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('agents',  'agents',  false, 1048576, array['text/x-python', 'text/plain']),
  ('replays', 'replays', true,  1048576, array['application/gzip'])
on conflict (id) do nothing;
