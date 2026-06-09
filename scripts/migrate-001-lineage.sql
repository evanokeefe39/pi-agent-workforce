-- Migration 001: Artifact lineage edges
-- Idempotent — safe to run on existing deployments

\connect artifact_store

CREATE TABLE IF NOT EXISTS artifact_edges (
    source_id   TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    target_id   TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
    edge_type   TEXT NOT NULL CHECK (edge_type IN (
        'derived_from',
        'informed_by',
        'cites',
        'contains',
        'references',
        'extracted_from'
    )),
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_target ON artifact_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON artifact_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON artifact_edges(edge_type);

GRANT ALL PRIVILEGES ON TABLE artifact_edges TO artifact;
