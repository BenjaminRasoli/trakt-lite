-- AlterTable
CREATE SEQUENCE media_id_seq;
ALTER TABLE "Media" ALTER COLUMN "id" SET DEFAULT nextval('media_id_seq');
ALTER SEQUENCE media_id_seq OWNED BY "Media"."id";
