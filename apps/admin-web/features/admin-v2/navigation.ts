export const adminV2Navigation = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard" }
    ]
  },
  {
    title: "Access Clients",
    items: [
      { href: "/applications", label: "Applications" },
      { href: "/agents", label: "Agents" },
      { href: "/runtimes", label: "Runtime Registrations" }
    ]
  },
  {
    title: "Target Access",
    items: [
      { href: "/target-resources", label: "Target Resources" },
      { href: "/target-connections", label: "Target Connections" },
      { href: "/access-grants", label: "Access Grants" }
    ]
  },
  {
    title: "Security",
    items: [
      { href: "/keys", label: "Signing Keys" },
      { href: "/audit-events", label: "Audit Events" }
    ]
  }
] as const;
