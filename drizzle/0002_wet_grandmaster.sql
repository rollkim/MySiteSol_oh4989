CREATE TABLE "admin_login_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"login_id" varchar(40) NOT NULL,
	"client_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_login_attempts_lookup_idx" ON "admin_login_attempts" USING btree ("login_id","client_ip","created_at" DESC NULLS LAST);