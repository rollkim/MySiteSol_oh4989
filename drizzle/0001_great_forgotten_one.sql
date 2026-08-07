ALTER TABLE "properties" ADD COLUMN "premium_fee" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_type_current" varchar(30);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "business_type_recommended" varchar(60);