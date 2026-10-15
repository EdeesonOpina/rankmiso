export interface BrandConfig {
  identity: {
    name: string;
    shortName: string;
    slug: string;
    ecosystem: string;
    tagline: string;
    description: string;
  };
  links: {
    website: string | null;
    github: string | null;
    documentation: string | null;
    support: string | null;
  };
  assets: {
    logoLight: string;
    logoDark: string;
    icon: string;
  };
  browser: {
    geckoId: string;
  };
}

export const brandConfig: BrandConfig = {
  identity: {
    name: "RankMiso",
    shortName: "RankMiso",
    slug: "rankmiso",
    ecosystem: "Miso",
    tagline: "Every page. Every detail.",
    description: "A free, open-source SEO browser extension.",
  },
  links: {
    website: null,
    github: null,
    documentation: null,
    support: null,
  },
  assets: {
    logoLight: "/brand/logo-light.png",
    logoDark: "/brand/logo-dark.png",
    icon: "/brand/icon.png",
  },
  browser: {
    geckoId: "rankmiso@local.dev",
  },
};
