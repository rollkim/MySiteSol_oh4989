ALTER TABLE "inquiries" ADD COLUMN "inquiry_kind" varchar(20);--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "interest_dong" varchar(30);--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "interest_building_type" varchar(20);--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN "marketing_consent_at" timestamp with time zone;