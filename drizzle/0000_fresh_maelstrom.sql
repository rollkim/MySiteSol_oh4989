CREATE TABLE "admin_users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"login_id" varchar(40) NOT NULL,
	"password_hash" varchar(100) NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_login_id_unique" UNIQUE("login_id")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inquiries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"property_id" bigint,
	"name" varchar(40) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'NEW' NOT NULL,
	"admin_memo" text,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"created_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_requests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "owner_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" varchar(40) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"address_hint" varchar(200),
	"deal_type" varchar(20),
	"message" text,
	"status" varchar(20) DEFAULT 'NEW' NOT NULL,
	"admin_memo" text,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"created_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "properties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" varchar(100) NOT NULL,
	"building_type" varchar(20) NOT NULL,
	"deal_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"sale_price" integer,
	"deposit" integer,
	"monthly_rent" integer,
	"exclusive_area" numeric(7, 1) NOT NULL,
	"supply_area" numeric(7, 1),
	"floor" smallint,
	"total_floor" smallint NOT NULL,
	"floor_display" varchar(20) DEFAULT 'EXACT' NOT NULL,
	"room_count" smallint,
	"bath_count" smallint,
	"direction" varchar(4),
	"direction_base" varchar(20),
	"move_in_date" varchar(20),
	"approval_date" date,
	"parking_total" smallint,
	"parking_per_unit" numeric(3, 1),
	"building_use" varchar(50),
	"maintenance_fee" integer,
	"maintenance_detail" jsonb,
	"sido" varchar(20) NOT NULL,
	"sigungu" varchar(30) NOT NULL,
	"dong" varchar(30) NOT NULL,
	"bjd_code" varchar(10) NOT NULL,
	"jibun_address" varchar(200) NOT NULL,
	"road_address" varchar(200),
	"detail_address" varchar(100),
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"video_url" varchar(300),
	"video_duration" varchar(10),
	"video_summary" varchar(100),
	"video_thumb_image_id" bigint,
	"field_checked_at" date,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"property_id" bigint NOT NULL,
	"file_path" varchar(300) NOT NULL,
	"thumb_path" varchar(300) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "property_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"property_id" bigint NOT NULL,
	"action" varchar(20) NOT NULL,
	"admin_user_id" bigint,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_options" (
	"property_id" bigint NOT NULL,
	"option_code" varchar(30) NOT NULL,
	CONSTRAINT "property_options_property_id_option_code_pk" PRIMARY KEY("property_id","option_code")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"setting_key" varchar(60) PRIMARY KEY NOT NULL,
	"setting_value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_video_thumb_image_id_property_images_id_fk" FOREIGN KEY ("video_thumb_image_id") REFERENCES "public"."property_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_logs" ADD CONSTRAINT "property_logs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_logs" ADD CONSTRAINT "property_logs_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_options" ADD CONSTRAINT "property_options_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_status_recent_idx" ON "inquiries" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "inquiries_ip_recent_idx" ON "inquiries" USING btree ("created_ip","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "owner_requests_status_recent_idx" ON "owner_requests" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "properties_active_geo_idx" ON "properties" USING btree ("lat","lng") WHERE "properties"."status" = 'ACTIVE' AND "properties"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "properties_active_dong_idx" ON "properties" USING btree ("dong") WHERE "properties"."status" = 'ACTIVE' AND "properties"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "properties_active_recent_idx" ON "properties" USING btree ("created_at" DESC NULLS LAST) WHERE "properties"."status" = 'ACTIVE' AND "properties"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "properties_type_idx" ON "properties" USING btree ("deal_type","building_type");--> statement-breakpoint
CREATE INDEX "property_images_property_idx" ON "property_images" USING btree ("property_id","sort_order");--> statement-breakpoint
CREATE INDEX "property_logs_property_idx" ON "property_logs" USING btree ("property_id","created_at" DESC NULLS LAST);