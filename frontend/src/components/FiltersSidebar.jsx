import React from 'react';

function FilterGroup({ title, items, selected, onChange, name }) {
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
          {item.label}
        </label>
      ))}
    </div>
  );
}

export default function FiltersSidebar({ filterOptions, filters, onToggleFilter, onReset }) {
  if (!filterOptions) return null;

  return (
    <aside className="filters-sidebar">
      <h3>Filters:</h3>
      <FilterGroup title="Competition status:" items={filterOptions.status} selected={filters.status} onChange={onToggleFilter} name="status" />
      <FilterGroup title="Tournament type:" items={filterOptions.event_type} selected={filters.event_type} onChange={onToggleFilter} name="event_type" />
      <FilterGroup title="Type of participation:" items={filterOptions.participation_type} selected={filters.participation_type} onChange={onToggleFilter} name="participation_type" />
      <FilterGroup title="Industry:" items={filterOptions.industry} selected={filters.industry} onChange={onToggleFilter} name="industry" />
      <FilterGroup title="Difficulty:" items={filterOptions.difficulty} selected={filters.difficulty} onChange={onToggleFilter} name="difficulty" />
      <button className="reset-btn" onClick={onReset}>Reset Filters</button>
    </aside>
  );
}
