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
          {item.label || t(`options.${name}.${item.value}`, { defaultValue: item.value })}
        </label>
      ))}
    </div>
  );
}

export default function FiltersSidebar({ filterOptions, filters, onToggleFilter, onReset }) {
  const { t } = useLanguage();

  if (!filterOptions) return null;

  const groups = [
    { name: "event_type", title: t("filters.eventType") },
    { name: "participation_type", title: t("filters.participationType") },
    { name: "industry", title: t("filters.industry") },
    { name: "difficulty", title: t("filters.difficulty") },
    { name: "language", title: t("filters.language") },
  ];

  return (
    <aside className="filters-sidebar">
      <h3>{t("filters.title")}</h3>
      {groups.map((group) => (
        <FilterGroup
          key={group.name}
          title={group.title}
          items={filterOptions[group.name] || []}
          selected={filters[group.name] || []}
          onChange={onToggleFilter}
          name={group.name}
          t={t}
        />
      ))}
      <button className="reset-btn" onClick={onReset}>{t("filters.reset")}</button>
    </aside>
  );
}
