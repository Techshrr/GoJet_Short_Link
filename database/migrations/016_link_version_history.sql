CREATE TABLE link_versions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    link_id BIGINT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    snapshot JSON NOT NULL,
    change_reason VARCHAR(255) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(link_id) REFERENCES short_links(id) ON DELETE CASCADE,
    FOREIGN KEY(created_by) REFERENCES users(id),
    UNIQUE KEY link_versions_revision_unique(link_id,revision),
    KEY link_versions_link_created_idx(link_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO link_versions(link_id,revision,snapshot,change_reason,created_by,created_at)
SELECT id,1,JSON_OBJECT(
    'destination',destination,'title',title,'status',status,'redirect_status',redirect_status,
    'expires_at',expires_at,'max_clicks',max_clicks,'one_time',one_time,'folder_id',folder_id,
    'campaign_id',campaign_id,'utm',COALESCE(utm,JSON_OBJECT()),
    'tag_ids',COALESCE((SELECT JSON_ARRAYAGG(lt.tag_id) FROM link_tags lt WHERE lt.link_id=short_links.id),JSON_ARRAY()),
    'routing_rules',COALESCE(routing_rules,JSON_ARRAY()),'ab_destinations',COALESCE(ab_destinations,JSON_ARRAY()),
    'password_protected',password_hash IS NOT NULL
),'迁移现有链接配置',created_by,created_at FROM short_links;
