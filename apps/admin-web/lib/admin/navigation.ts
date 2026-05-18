import type { I18nTranslator } from "@/lib/i18n/translate";

export function getAdminNavigation(t: I18nTranslator) {
  return [
    {
      title: t("admin.nav.group.overview"),
      items: [
        { href: "/dashboard", label: t("nav.dashboard") }
      ]
    },
    {
      title: t("admin.nav.group.accessClients"),
      items: [
        { href: "/applications", label: t("nav.oauthClients") },
        { href: "/agents", label: t("nav.agents") },
        { href: "/runtimes", label: t("nav.runtimes") }
      ]
    },
    {
      title: t("admin.nav.group.targetAccess"),
      items: [
        { href: "/target-resources", label: t("nav.targetResources") },
        { href: "/target-connections", label: t("nav.targetConnections") },
        { href: "/access-grants", label: t("nav.accessGrants") }
      ]
    },
    {
      title: t("admin.nav.group.security"),
      items: [
        { href: "/keys", label: t("nav.keys") },
        { href: "/audit-events", label: t("nav.auditEvents") }
      ]
    }
  ] as const;
}
