-- CreateTable
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "asker_user_id" TEXT NOT NULL,
    "question_text" VARCHAR(2000) NOT NULL,
    "answer_text" VARCHAR(2000),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_questions_product_id_is_published_created_at_idx" ON "product_questions"("product_id", "is_published", "created_at");

-- CreateIndex
CREATE INDEX "product_questions_product_id_created_at_idx" ON "product_questions"("product_id", "created_at");

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_asker_user_id_fkey" FOREIGN KEY ("asker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
