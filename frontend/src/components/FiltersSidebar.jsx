import React from 'react';
import { useLanguage } from "../context/LanguageContext";

function FilterGroup({ title, items, selected, onChange, name, t }) {
  return (
    <div className="filter-group">
      <div className="filter-title">{title}</div>
      {items.map((item) => (
        <label key={item.value} className="filter-option">
          <input
            type="checkbox"
            checked={selected.includes(item.value)}
            onChange={() => onChange(name, item.value)}
          />
          {t(`options.${name}.${item.value}`, { defaultValue: item.label })}
        </label>
      ))}
    </div>
  );
}

export default function FiltersSidebar({ filterOptions, filters, onToggleFilter, onReset }) {
  const { t } = useLanguage();

  if (!filterOptions) return null;

  return (
    <aside className="filters-sidebar">
      <h3>{t("filters.title")}</h3>
      <FilterGroup title={t("filters.status")} items={filterOptions.status} selected={filters.status} onChange={onToggleFilter} name="status" t={t} />
      <FilterGroup title={t("filters.eventType")} items={filterOptions.event_type} selected={filters.event_type} onChange={onToggleFilter} name="event_type" t={t} />
      <FilterGroup title={t("filters.participationType")} items={filterOptions.participation_type} selected={filters.participation_type} onChange={onToggleFilter} name="participation_type" t={t} />
      <FilterGroup title={t("filters.industry")} items={filterOptions.industry} selected={filters.industry} onChange={onToggleFilter} name="industry" t={t} />
      <FilterGroup title={t("filters.difficulty")} items={filterOptions.difficulty} selected={filters.difficulty} onChange={onToggleFilter} name="difficulty" t={t} />
      <FilterGroup title={t("filters.language")} items={filterOptions.language || []} selected={filters.language || []} onChange={onToggleFilter} name="language" t={t} />
      <button className="reset-btn" onClick={onReset}>{t("filters.reset")}</button>
    </aside>
  );
}
