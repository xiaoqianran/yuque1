-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" CHAR(26) NOT NULL,
    "mobile_e164" VARCHAR(20) NOT NULL,
    "mobile_verified" BOOLEAN NOT NULL DEFAULT true,
    "nickname" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" TEXT,
    "avatar_url" VARCHAR(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" CHAR(26) NOT NULL,
    "owner_user_id" CHAR(26) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" CHAR(26) NOT NULL,
    "workspace_id" CHAR(26) NOT NULL,
    "owner_user_id" CHAR(26) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(2000),
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "knowledge_bases_visibility_check" CHECK ("visibility" = 'private')
);

-- CreateTable
CREATE TABLE "kb_members" (
    "id" CHAR(26) NOT NULL,
    "knowledge_base_id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "kb_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kb_members_role_check" CHECK ("role" IN ('owner', 'editor', 'reader'))
);

-- CreateTable
CREATE TABLE "tree_nodes" (
    "id" CHAR(26) NOT NULL,
    "knowledge_base_id" CHAR(26) NOT NULL,
    "parent_id" CHAR(26),
    "type" TEXT NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" CHAR(26) NOT NULL,
    "updated_by" CHAR(26),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tree_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tree_nodes_type_check" CHECK ("type" IN ('folder', 'doc'))
);

-- CreateTable
CREATE TABLE "document_contents" (
    "node_id" CHAR(26) NOT NULL,
    "body_md" TEXT NOT NULL DEFAULT '',
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" CHAR(26),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "document_contents_pkey" PRIMARY KEY ("node_id"),
    CONSTRAINT "document_contents_version_check" CHECK ("content_version" >= 1)
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" CHAR(26) NOT NULL,
    "node_id" CHAR(26) NOT NULL,
    "version" INTEGER NOT NULL,
    "body_md" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_revisions_reason_check" CHECK ("reason" = 'overwrite_on_conflict')
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" CHAR(26) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "node_id" CHAR(26) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ(6),
    "created_by" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" CHAR(26) NOT NULL,
    "actor_user_id" CHAR(26),
    "action" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(32) NOT NULL,
    "resource_id" VARCHAR(64),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_id" VARCHAR(64),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_e164_key" ON "users"("mobile_e164");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_owner_user_id_key" ON "workspaces"("owner_user_id");

-- CreateIndex
CREATE INDEX "knowledge_bases_workspace_id_idx" ON "knowledge_bases"("workspace_id");

-- CreateIndex
CREATE INDEX "knowledge_bases_owner_user_id_idx" ON "knowledge_bases"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "kb_members_knowledge_base_id_user_id_key" ON "kb_members"("knowledge_base_id", "user_id");

-- CreateIndex
CREATE INDEX "kb_members_user_id_knowledge_base_id_idx" ON "kb_members"("user_id", "knowledge_base_id");

-- CreateIndex
CREATE INDEX "tree_nodes_knowledge_base_id_parent_id_sort_order_idx" ON "tree_nodes"("knowledge_base_id", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "tree_nodes_parent_id_idx" ON "tree_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "content_revisions_node_id_version_idx" ON "content_revisions"("node_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at");

-- Design-01 §10.1 partial uniques
CREATE UNIQUE INDEX "uq_kb_one_owner" ON "kb_members" ("knowledge_base_id") WHERE "role" = 'owner';
CREATE UNIQUE INDEX "uq_share_one_active" ON "share_links" ("node_id") WHERE "enabled" = true;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kb_members" ADD CONSTRAINT "kb_members_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kb_members" ADD CONSTRAINT "kb_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tree_nodes" ADD CONSTRAINT "tree_nodes_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tree_nodes" ADD CONSTRAINT "tree_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tree_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_contents" ADD CONSTRAINT "document_contents_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "tree_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "tree_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "share_links" ADD CONSTRAINT "share_links_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "tree_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
