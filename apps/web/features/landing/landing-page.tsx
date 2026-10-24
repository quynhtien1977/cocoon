"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Search, UserRound, Menu, Leaf, Heart, Recycle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import assets from "@/public/images/landing/sources.json";
import styles from "./landing.module.css";
import { ProductSpotlight } from "./product-spotlight";
import { ProductCarousel } from "./product-carousel";

const image = (key: keyof typeof assets) => assets[key].src;
const slides = [
  { image: image("hero-0"), eyebrow: "Một lựa chọn xanh hơn", title: "Túi refill gel bí đao rửa mặt", text: "Nạp đầy chai quen thuộc, tiếp nối thói quen chăm da. Khám phá phiên bản refill 500ml và cùng Cocoon giảm bớt bao bì nhựa mỗi ngày.", color: "#fcffe9" },
  { image: image("hero-1"), eyebrow: "Từ nguyên liệu Việt Nam", title: "Gel tắm nghệ Hưng Yên", text: "Để mỗi lần chăm sóc cơ thể là một khoảnh khắc gần hơn với thiên nhiên. Khám phá dòng sản phẩm từ nghệ Hưng Yên.", color: "#f6e5c4" },
  { image: image("hero-2"), eyebrow: "Chăm sóc mỗi ngày", title: "Bí đao — dịu dàng với làn da", text: "Từ nguyên liệu quen thuộc trong khu vườn Việt, Cocoon mang đến những lựa chọn chăm sóc da dành cho bạn.", color: "#edf0df" },
];
const products = [
  { name: "Sữa chống nắng vô cơ sen Hậu Giang", size: "50ml · Tone up Beige", category: "Chăm sóc da", image: image("product-0"), hoverImage: image("product-0-hover"), price: "449.000 ₫", url: "https://cocoonvietnam.com/san-pham/sua-chong-nang-vo-co-sen-hau-giang-50ml-tone-up-beige" },
  { name: "Nước dưỡng tóc tinh dầu bưởi", size: "140ml", category: "Chăm sóc tóc", image: image("product-1"), hoverImage: image("product-1-hover"), price: "162.000 ₫", url: "https://cocoonvietnam.com/san-pham/nuoc-duong-toc-tinh-dau-buoi-140ml-1" },
  { name: "Mặt nạ nghệ Hưng Yên", size: "100ml", category: "Chăm sóc da", image: image("product-2"), hoverImage: image("product-2-hover"), price: "339.000 ₫", url: "https://cocoonvietnam.com/san-pham/mat-na-nghe-hung-yen-100ml" },
  { name: "Nước tẩy trang bí đao", size: "500ml", category: "Chăm sóc da", image: image("product-3"), hoverImage: image("product-3-hover"), price: "299.000 ₫", url: "https://cocoonvietnam.com/san-pham/nuoc-tay-trang-bi-dao-500ml" },
  { name: "Cà phê Đắk Lắk làm sạch da chết cơ thể", size: "200ml", category: "Chăm sóc da", image: image("product-4"), hoverImage: image("product-4-hover"), price: "133.000 ₫", url: "https://cocoonvietnam.com/san-pham/ca-phe-dak-lak-lam-sach-da-chet-co-the-200ml" },
];
const ingredients = [
  { name: "Bí đao", region: "Thanh mát & dịu lành", image: image("ingredient-0") },
  { name: "Bưởi Việt Nam", region: "Hương thơm từ vườn nhà", image: image("ingredient-1") },
  { name: "Nghệ Hưng Yên", region: "Sắc vàng từ đất mẹ", image: image("ingredient-2") },
  { name: "Cà phê Đắk Lắk", region: "Tinh túy miền cao nguyên", image: image("ingredient-3") },
];
const articles = [
  { title: "Cùng Cocoon đồng hành với rùa biển Côn Đảo", category: "Trách nhiệm cộng đồng", image: image("article-0"), href: "https://cocoonvietnam.com/bai-viet/chuong-trinh-bao-ton-rua-bien-tai-con-dao-rua-con-kien-cuong-ve-bien" },
  { title: "Điểm xanh online — bắt đầu từ những điều nhỏ", category: "Sống xanh", image: image("article-1"), href: "https://cocoonvietnam.com/bai-viet" },
  { title: "Trao một vỏ chai cũ, tiếp nối một hành trình xanh", category: "Cocoon & bạn", image: image("article-2"), href: "https://cocoonvietnam.com/bai-viet" },
];
const links = [{ href: "#san-pham", label: "Sản phẩm" }, { href: "#cau-chuyen", label: "Cocoon" }, { href: "#nguyen-lieu", label: "Nguyên liệu" }, { href: "#bai-viet", label: "Bài viết" }, { href: "#ket-noi", label: "Kết nối" }];

export function LandingPage() {
  const [slide, setSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSlide((previous) => (previous + 1) % slides.length);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [slide]);

  const returnToTop = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("dau-trang")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  };

  const current = slides[slide];
  const visibleProducts = products.filter((product) => (category === "Tất cả" || product.category === category) && product.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  return (
    <div id="dau-trang" tabIndex={-1} className={styles.landing} data-portal="public">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <div className={styles.announcement}>MỸ PHẨM 100% THUẦN CHAY · TỰ HÀO TỪ THỰC VẬT VIỆT NAM</div>
      <header className={styles.header}>
        <nav aria-label="Điều hướng chính" className={styles.desktopNav}>{links.slice(0, 3).map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <div className={styles.mobileMenu}><Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className={styles.iconButton} aria-label="Mở menu"><Menu size={22} /></SheetTrigger>
          <SheetContent side="left" className="p-6"><SheetHeader><SheetTitle>Khám phá Cocoon</SheetTitle></SheetHeader>
            <nav aria-label="Điều hướng mobile" className="flex flex-col gap-6 py-6">{links.map((link) => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}<Link href="/login">Đăng nhập</Link><Link href="/register">Đăng ký</Link></nav>
          </SheetContent>
        </Sheet></div>
        <a href="#dau-trang" onClick={returnToTop} className={styles.logo} aria-label="Cocoon — Về đầu trang"><Image src={image("logo")} alt="Cocoon Original Vietnam" width={164} height={68} priority /></a>
        <div className={styles.headerRight}><nav aria-label="Khám phá" className={styles.desktopNav}>{links.slice(3).map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
          <button type="button" className={styles.iconButton} aria-label={searchOpen ? "Đóng tìm kiếm" : "Tìm sản phẩm"} aria-expanded={searchOpen} onClick={() => setSearchOpen(!searchOpen)}><Search size={20} /></button>
          <Link href="/login" className={styles.iconButton} aria-label="Đăng nhập tài khoản"><UserRound size={20} /></Link>
        </div>
      </header>
      {searchOpen && <form className={styles.searchPanel} onSubmit={(event) => { event.preventDefault(); setCategory("Tất cả"); document.getElementById("san-pham")?.scrollIntoView({ behavior: "smooth" }); }}>
        <label htmlFor="landing-search">Bạn đang tìm sản phẩm nào?</label><div><input autoFocus id="landing-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên sản phẩm, ví dụ: bí đao…" /><button type="submit" aria-label="Xem kết quả tìm kiếm"><ArrowRight /></button></div>
      </form>}
      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero} aria-label="Bộ sưu tập nổi bật" aria-roledescription="carousel">
          <div className={styles.heroImage}><Image key={current.image} src={current.image} alt={current.title} fill priority sizes="(min-width: 900px) 55vw, 100vw" /></div>
          <div className={styles.heroText} style={{ backgroundColor: current.color }}>
            <span className={styles.eyebrow}>{current.eyebrow}</span><h1>{current.title}</h1><p>{current.text}</p>
            <a href="#san-pham" className={styles.darkLink}>KHÁM PHÁ NGAY <ArrowRight size={20} /></a>
            <div className={styles.slideControls}>
              <div className={styles.arrows}><button type="button" aria-label="Bộ sưu tập trước" onClick={() => setSlide((slide + slides.length - 1) % slides.length)}><ChevronLeft /></button><button type="button" aria-label="Bộ sưu tập tiếp theo" onClick={() => setSlide((slide + 1) % slides.length)}><ChevronRight /></button></div>
            </div>
          </div>
        </section>
        <div className={styles.values}><span><Leaf />100% thuần chay</span><span><Heart />Không thử nghiệm trên động vật</span><span><Recycle />Trân trọng môi trường</span></div>
        <ProductSpotlight />
        <section className={styles.certifications} aria-label="Chứng nhận của thương hiệu Cocoon"><span className={styles.eyebrow}>Được chứng nhận bởi các tổ chức quốc tế</span><div>{["Leaping Bunny", "The Vegan Society", "PETA"].map((name, index) => <a href="https://cocoonvietnam.com/trang/gia-tri-cot-loi" target="_blank" rel="noreferrer" key={name}><Image src={image(`cert-${index}` as keyof typeof assets)} alt={name} width={100} height={80} /><h3>{name}</h3><p>{["Cam kết không thử nghiệm trên động vật", "Mỹ phẩm không có thành phần từ động vật", "Tôn trọng sự sống của muôn loài"][index]}</p></a>)}</div></section>
        <section id="san-pham" className={styles.products}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Được yêu thích mỗi ngày</span><h2>Sản phẩm bán chạy</h2></div><Link href="/account/recommendations" className={styles.textLink}>GỢI Ý CHO BẠN <ArrowRight size={18} /></Link></div>
          <div className={styles.tabs} aria-label="Lọc danh mục">{["Tất cả", "Chăm sóc da", "Chăm sóc tóc"].map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}</div>
          {visibleProducts.length > 0 && <ProductCarousel key={`${category}:${query}`} products={visibleProducts} />}
          {!visibleProducts.length && <p role="status" className={styles.noResults}>Không tìm thấy sản phẩm. <button type="button" onClick={() => { setQuery(""); setCategory("Tất cả"); }}>Xem tất cả sản phẩm</button></p>}
          <p className={styles.priceNote}>Giá tham khảo từ website Cocoon. Xem sản phẩm trên website thương hiệu để biết giá hiện tại.</p>
        </section>
        <section id="nguyen-lieu" className={styles.ingredients}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Hồn Việt trong từng sản phẩm</span><h2>Câu chuyện nguyên liệu</h2></div><p>Những vùng đất thân quen.<br />Những món quà thiên nhiên đầy cảm hứng.</p></div><div className={styles.ingredientGrid}>{ingredients.map((item) => <a href="https://cocoonvietnam.com/trang/tim-hieu-nguyen-lieu" target="_blank" rel="noreferrer" key={item.name}><div><Image src={item.image} alt={item.name} fill sizes="(min-width: 900px) 25vw, 50vw" /></div><span>{item.region}</span><h3>{item.name} <ArrowUpRight size={20} /></h3></a>)}</div></section>
        <section id="bai-viet" className={styles.journal}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Cocoon & những điều tử tế</span><h2>Chuyện nhà Cocoon</h2></div><a href="https://cocoonvietnam.com/bai-viet" target="_blank" rel="noreferrer" className={styles.textLink}>TẤT CẢ BÀI VIẾT <ArrowUpRight size={18} /></a></div><div className={styles.articleGrid}>{articles.map((article) => <a href={article.href} target="_blank" rel="noreferrer" key={article.title}><div className={styles.articleImage}><Image src={article.image} alt={article.title} fill sizes="(min-width: 900px) 33vw, 100vw" /></div><span className={styles.eyebrow}>{article.category}</span><h3>{article.title}</h3><span className={styles.textLink}>ĐỌC CÂU CHUYỆN <ArrowUpRight size={16} /></span></a>)}</div></section>
        <section id="ket-noi" className={styles.connect}><span className={styles.eyebrow}>Một hành trình, cùng nhau</span><h2>Lắng nghe làn da.<br />Kết nối cùng Cocoon.</h2><p>Tạo tài khoản để chia sẻ trải nghiệm, tham gia khảo sát<br className={styles.desktopBreak} /> và khám phá những gợi ý dành cho bạn.</p><Link href="/register" className={styles.darkLink}>TRỞ THÀNH MỘT PHẦN CỦA COCOON <ArrowRight size={20} /></Link></section>
      </main>
      <footer className={styles.footer}><div className={styles.footerTop}><div><a href="#dau-trang" onClick={returnToTop} aria-label="Cocoon — Về đầu trang"><Image src={image("logo")} alt="Cocoon Original Vietnam" width={184} height={70} /></a><p>Mỹ phẩm thuần chay<br />cho nét đẹp thuần Việt.</p></div><div><h3>KHÁM PHÁ</h3>{links.slice(0,4).map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div><div><h3>ĐỒNG HÀNH CÙNG BẠN</h3><Link href="/login">Đăng nhập</Link><Link href="/register">Tạo tài khoản</Link><Link href="/account/feedback">Chia sẻ trải nghiệm</Link><Link href="/account/surveys">Khảo sát dành cho bạn</Link></div><div><h3>KẾT NỐI</h3><a href="https://www.facebook.com/CocoonVietnamOfficial" target="_blank" rel="noreferrer">Facebook ↗</a><a href="https://www.instagram.com/cocoon.vietnam/" target="_blank" rel="noreferrer">Instagram ↗</a><a href="https://cocoonvietnam.com/" target="_blank" rel="noreferrer">Website thương hiệu ↗</a></div></div><div className={styles.footerBottom}><a href="#dau-trang" onClick={returnToTop}>Cocoon CRM · Chăm sóc và kết nối</a><span>Hình ảnh thương hiệu: Cocoon Vietnam</span><a href="#dau-trang" onClick={returnToTop}>VỀ ĐẦU TRANG ↑</a></div></footer>
    </div>
  );
}
