CREATE TABLE "inquiry_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inquiry_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"inquiry_id" bigint NOT NULL,
	"action" varchar(20) NOT NULL,
	"memo" text,
	"admin_user_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_view_daily" (
	"property_id" bigint NOT NULL,
	"view_date" date NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "property_view_daily_property_id_view_date_pk" PRIMARY KEY("property_id","view_date")
);
--> statement-breakpoint
DROP INDEX "properties_active_geo_idx";--> statement-breakpoint
DROP INDEX "properties_active_dong_idx";--> statement-breakpoint
DROP INDEX "properties_active_recent_idx";--> statement-breakpoint
ALTER TABLE "inquiries" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_requests" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "owner_requests" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "display_name" varchar(40);--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "admin_role" varchar(20) DEFAULT 'OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "contact_purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "inquiry_source" varchar(30);--> statement-breakpoint
ALTER TABLE "owner_requests" ADD COLUMN "contact_purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "listing_visibility" varchar(20) DEFAULT 'VISIBLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "deal_progress" varchar(20) DEFAULT 'AVAILABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "display_order" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "price_negotiable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "broker_fee_note" varchar(200);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "listing_code" varchar(20);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "naver_listing_no" varchar(20);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "map_pin_mode" varchar(20) DEFAULT 'EXACT' NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "exposure_checked_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inquiry_logs" ADD CONSTRAINT "inquiry_logs_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_logs" ADD CONSTRAINT "inquiry_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_view_daily" ADD CONSTRAINT "property_view_daily_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_logs_inquiry_idx" ON "inquiry_logs" USING btree ("inquiry_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "properties_public_geo_idx" ON "properties" USING btree ("lat","lng") WHERE "properties"."listing_visibility" = 'VISIBLE' AND "properties"."deleted_at" IS NULL AND "properties"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "properties_public_dong_idx" ON "properties" USING btree ("dong") WHERE "properties"."listing_visibility" = 'VISIBLE' AND "properties"."deleted_at" IS NULL AND "properties"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "properties_public_order_idx" ON "properties" USING btree ("display_order","created_at" DESC NULLS LAST) WHERE "properties"."listing_visibility" = 'VISIBLE' AND "properties"."deleted_at" IS NULL AND "properties"."archived_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_listing_code_key" ON "properties" USING btree ("listing_code") WHERE "properties"."listing_code" IS NOT NULL;