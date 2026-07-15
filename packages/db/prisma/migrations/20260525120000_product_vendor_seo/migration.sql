-- Phase F1: SEO meta fields for public product and store pages
ALTER TABLE "vendors" ADD COLUMN "meta_title" VARCHAR(70),
ADD COLUMN "meta_description" VARCHAR(160);

ALTER TABLE "products" ADD COLUMN "meta_title" VARCHAR(70),
ADD COLUMN "meta_description" VARCHAR(160);
