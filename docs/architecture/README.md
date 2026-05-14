# Judgify Architecture

This folder contains PlantUML diagrams for the Judgify platform.

Ця папка містить PlantUML діаграми архітектури та ключових сценаріїв Judgify.

## C4 Diagrams

- [System context source](c4/c4-context.puml) / [SVG](c4/Judgify_C4_Context.svg)
- [Container view source](c4/c4-container.puml) / [SVG](c4/Judgify_C4_Container.svg)
- [Backend component view source](c4/c4-component-backend.puml) / [SVG](c4/Judgify_C4_Backend_Components.svg)
- [Frontend component view source](c4/c4-component-frontend.puml) / [SVG](c4/Judgify_C4_Frontend_Components.svg)

## Sequence Diagrams

- [Join competition source](sequences/join-competition.puml) / [SVG](sequences/Judgify_Join_Competition.svg)
- [Create and publish competition source](sequences/create-and-publish-competition.puml) / [SVG](sequences/Judgify_Create_Publish_Competition.svg)
- [Submit work source](sequences/submit-work.puml) / [SVG](sequences/Judgify_Submit_Work.svg)
- [Manual judging source](sequences/manual-judging.puml) / [SVG](sequences/Judgify_Manual_Judging.svg)
- [Peer review source](sequences/peer-review.puml) / [SVG](sequences/Judgify_Peer_Review.svg)
- [Results publication source](sequences/results-publication.puml) / [SVG](sequences/Judgify_Results_Publication.svg)
- [Admin management source](sequences/admin-management.puml) / [SVG](sequences/Judgify_Admin_Management.svg)

The diagrams avoid external PlantUML includes so they can render in basic PUML tooling.

Діаграми не залежать від зовнішніх PlantUML include-файлів, тому мають відкриватися у базових PUML renderer-ах.

Shared visual styling lives in [`theme-judgify.puml`](theme-judgify.puml).

Спільний візуальний стиль зберігається у [`theme-judgify.puml`](theme-judgify.puml).
