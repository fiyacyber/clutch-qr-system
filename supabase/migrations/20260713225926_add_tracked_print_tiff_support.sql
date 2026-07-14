-- Permit the TIFF artwork format accepted by the tracked-print storefront.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/postscript',
  'application/illustrator',
  'image/tiff'
]
where id = 'print-order-files';

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'print-order-files') then
    raise exception 'print-order-files bucket must exist before TIFF support is applied';
  end if;
end $$;
