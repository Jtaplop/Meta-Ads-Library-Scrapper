import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingTypeBadge } from "../LandingTypeBadge";
import { MediaPreview } from "../MediaPreview";
import { ColumnPicker } from "../ColumnPicker";
import { AdsToolbar, INITIAL_FILTER_STATE } from "../AdsToolbar";
import type { EnrichedAd } from "@/lib/enrich";

describe("LandingTypeBadge", () => {
  it("renders instagram badge correctly", () => {
    render(<LandingTypeBadge type="instagram" />);
    expect(screen.getByText("Instagram")).toBeDefined();
  });

  it("renders whatsapp badge correctly", () => {
    render(<LandingTypeBadge type="whatsapp" />);
    expect(screen.getByText("WhatsApp")).toBeDefined();
  });

  it("renders custom domain when showDomain is true", () => {
    render(<LandingTypeBadge type="web" domain="example.com" showDomain />);
    expect(screen.getByText("example.com")).toBeDefined();
  });
});

describe("MediaPreview", () => {
  it("renders video element when videoUrl is provided", () => {
    const { container } = render(
      <MediaPreview
        videoUrl="https://video.fbcdn.net/v/123.mp4"
        imageUrl="https://scontent.fbcdn.net/v/thumb.jpg"
      />
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("https://video.fbcdn.net/v/123.mp4");
  });

  it("renders image element when imageUrl is provided without video", () => {
    const { container } = render(
      <MediaPreview imageUrl="https://scontent.fbcdn.net/v/image.jpg" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://scontent.fbcdn.net/v/image.jpg");
  });

  it("renders expired CDN fallback card when media fires error", () => {
    const { container } = render(
      <MediaPreview
        imageUrl="https://scontent.fbcdn.net/expired.jpg"
        snapshotUrl="https://facebook.com/ads/archive/render_ad/?id=999"
      />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();

    // Fire error event to simulate expired CDN URL
    fireEvent.error(img!);

    expect(
      screen.getByText("El enlace temporal del creativo en fbcdn.net ha caducado")
    ).toBeDefined();
    expect(
      screen.getByText("Ver anuncio original en Meta Ads Library")
    ).toBeDefined();
  });
});

describe("ColumnPicker", () => {
  it("allows toggling column visibility", () => {
    const onChange = vi.fn();
    render(
      <ColumnPicker
        visibleColumns={{ page_name: true, ig_username: true }}
        onChange={onChange}
      />
    );

    // Open dropdown
    const button = screen.getByRole("button", { name: /Columnas/i });
    fireEvent.click(button);

    expect(screen.getByText("Visibilidad de Columnas")).toBeDefined();

    // Toggle a column
    const igLabel = screen.getByText("@usuario (IG)");
    fireEvent.click(igLabel);

    expect(onChange).toHaveBeenCalled();
  });
});

describe("AdsToolbar", () => {
  const sampleAds: EnrichedAd[] = [
    {
      ad_id: "1",
      page_id: "p1",
      page_name: "Brand A",
      ad_text: "Promo text",
      ad_caption: "Promo caption",
      start_date: "2026-10-01",
      end_date: null,
      status: "ACTIVE",
      image_url: "https://fb.com/img.jpg",
      video_url: null,
      landing_page: "https://instagram.com/branda",
      snapshot_url: "https://facebook.com/ads/archive/1",
      ig_username: "branda",
      platforms: ["instagram"],
      days_active: 40,
      landing_type: "instagram",
      landing_domain: "instagram.com",
      has_video: false,
      has_image: true,
      is_winner: true,
      advertiser_key: "branda",
    },
    {
      ad_id: "2",
      page_id: "p2",
      page_name: "Brand B",
      ad_text: "Consulting",
      ad_caption: "Book call",
      start_date: "2026-11-01",
      end_date: null,
      status: "ACTIVE",
      image_url: null,
      video_url: null,
      landing_page: "https://calendly.com/brandb",
      snapshot_url: "https://facebook.com/ads/archive/2",
      ig_username: "@brandb",
      platforms: ["facebook"],
      days_active: 10,
      landing_type: "calendly",
      landing_domain: "calendly.com",
      has_video: false,
      has_image: false,
      is_winner: false,
      advertiser_key: "brandb",
    },
  ];

  it("renders toolbar with search and toggles", () => {
    const onFiltersChange = vi.fn();
    render(
      <AdsToolbar
        totalAdsCount={2}
        uniqueAdvertisersCount={2}
        filteredAds={sampleAds}
        selectedAds={[]}
        filters={INITIAL_FILTER_STATE}
        onFiltersChange={onFiltersChange}
        visibleColumns={{}}
        onVisibleColumnsChange={vi.fn()}
      />
    );

    expect(
      screen.getByPlaceholderText(
        "Buscar en texto, anunciante, @usuario, titular o landing..."
      )
    ).toBeDefined();
    expect(screen.getByText("1 fila por anunciante")).toBeDefined();
    expect(screen.getByText("Solo ganadores")).toBeDefined();
  });

  it("copies @usernames to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <AdsToolbar
        totalAdsCount={2}
        uniqueAdvertisersCount={2}
        filteredAds={sampleAds}
        selectedAds={[]}
        filters={INITIAL_FILTER_STATE}
        onFiltersChange={vi.fn()}
        visibleColumns={{}}
        onVisibleColumnsChange={vi.fn()}
      />
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar @usuarios/i });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("@branda\n@brandb");
  });
});
