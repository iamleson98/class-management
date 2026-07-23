package modelhelper

type City struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Deprecated bool    `json:"deprecated"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
}

func IsValidCityId(id string) (ok bool) {
	_, ok = AllCitiesMap[id]
	return
}

// list of all cities.
// NOTE: Do not change the ids since they are used in database
var (
	Hanoi = &City{
		ID:   "hanoi",
		Name: "Hà Nội",
		Lat:  21.0278,
		Lon:  105.8342,
	}
	HoChiMinh = &City{
		ID:   "hcm",
		Name: "Hồ Chí Minh",
		Lat:  10.7769,
		Lon:  106.7009,
	}
	DaNang = &City{
		ID:   "danang",
		Name: "Đà Nẵng",
		Lat:  16.0544,
		Lon:  108.2022,
	}
	HaiPhong = &City{
		ID:   "haiphong",
		Name: "Hải Phòng",
		Lat:  20.8449,
		Lon:  106.6881,
	}
	CanTho = &City{
		ID:   "cantho",
		Name: "Cần Thơ",
		Lat:  10.0452,
		Lon:  105.7469,
	}
	AnGiang = &City{
		ID:   "angiang",
		Name: "An Giang",
		Lat:  10.5231,
		Lon:  105.1368,
	}
	BaRiaVungTau = &City{
		ID:   "bariavungtau",
		Name: "Bà Rịa - Vũng Tàu",
		Lat:  10.4114,
		Lon:  107.1362,
	}
	BacGiang = &City{
		ID:   "bacgiang",
		Name: "Bắc Giang",
		Lat:  21.2711,
		Lon:  106.1959,
	}
	BacKan = &City{
		ID:   "backan",
		Name: "Bắc Kạn",
		Lat:  22.1492,
		Lon:  105.8368,
	}
	BacLieu = &City{
		ID:   "baclieu",
		Name: "Bạc Liêu",
		Lat:  9.2878,
		Lon:  105.7281,
	}
	BacNinh = &City{
		ID:   "bacninh",
		Name: "Bắc Ninh",
		Lat:  21.15,
		Lon:  106.05,
	}
	BenTre = &City{
		ID:   "bentre",
		Name: "Bến Tre",
		Lat:  10.2361,
		Lon:  106.373,
	}
	BinhDinh = &City{
		ID:   "binhdinh",
		Name: "Bình Định",
		Lat:  13.7821,
		Lon:  109.2191,
	}
	BinhDuong = &City{
		ID:   "binhduong",
		Name: "Bình Dương",
		Lat:  11.9466,
		Lon:  106.7568,
	}
	BinhPhuoc = &City{
		ID:   "binhphuoc",
		Name: "Bình Phước",
		Lat:  11.8037,
		Lon:  106.7998,
	}
	BinhThuan = &City{
		ID:   "binhthuan",
		Name: "Bình Thuận",
		Lat:  11.04,
		Lon:  108.08,
	}
	CaMau = &City{
		ID:   "camau",
		Name: "Cà Mau",
		Lat:  9.1765,
		Lon:  105.1538,
	}
	CaoBang = &City{
		ID:   "caobang",
		Name: "Cao Bằng",
		Lat:  22.6688,
		Lon:  106.0438,
	}
	DakLak = &City{
		ID:   "daklak",
		Name: "Đắk Lắk",
		Lat:  12.6745,
		Lon:  108.05,
	}
	DakNong = &City{
		ID:   "daknong",
		Name: "Đắk Nông",
		Lat:  12.25,
		Lon:  107.5,
	}
	DienBien = &City{
		ID:   "dienbien",
		Name: "Điện Biên",
		Lat:  21.38,
		Lon:  103.02,
	}
	DongNai = &City{
		ID:   "dongnai",
		Name: "Đồng Nai",
		Lat:  10.8,
		Lon:  106.7,
	}
	DongThap = &City{
		ID:   "dongthap",
		Name: "Đồng Tháp",
		Lat:  10.65,
		Lon:  105.6,
	}
	GiaLai = &City{
		ID:   "gialai",
		Name: "Gia Lai",
		Lat:  13.5833,
		Lon:  108.0,
	}
	HaGiang = &City{
		ID:   "hagiang",
		Name: "Hà Giang",
		Lat:  22.7833,
		Lon:  104.9833,
	}
	HaNam = &City{
		ID:   "hanam",
		Name: "Hà Nam",
		Lat:  20.5833,
		Lon:  105.9167,
	}
	HaTinh = &City{
		ID:   "hatinh",
		Name: "Hà Tĩnh",
		Lat:  18.3333,
		Lon:  105.9,
	}
	HaiDuong = &City{
		ID:         "haiduong",
		Name:       "Hải Dương",
		Lat:        20.9333,
		Lon:        106.3333,
		Deprecated: true,
	}
	HauGiang = &City{
		ID:   "haugiang",
		Name: "Hậu Giang",
		Lat:  9.7833,
		Lon:  105.5,
	}
	HoaBinh = &City{
		ID:   "hoabinh",
		Name: "Hòa Bình",
		Lat:  20.8167,
		Lon:  105.3333,
	}
	HungYen = &City{
		ID:   "hungyen",
		Name: "Hưng Yên",
		Lat:  20.85,
		Lon:  106.0,
	}
	KhanhHoa = &City{
		ID:   "khanhhoa",
		Name: "Khánh Hòa",
		Lat:  12.25,
		Lon:  109.2,
	}
	KienGiang = &City{
		ID:   "kiengiang",
		Name: "Kiên Giang",
		Lat:  10.0,
		Lon:  105.0,
	}
	KonTum = &City{
		ID:   "kontum",
		Name: "Kon Tum",
		Lat:  14.35,
		Lon:  107.8,
	}
	LaiChau = &City{
		ID:   "laichau",
		Name: "Lai Châu",
		Lat:  22.3833,
		Lon:  103.3,
	}
	LamDong = &City{
		ID:   "lamdong",
		Name: "Lâm Đồng",
		Lat:  11.5833,
		Lon:  108.0,
	}
	LangSon = &City{
		ID:   "langson",
		Name: "Lạng Sơn",
		Lat:  21.85,
		Lon:  106.75,
	}
	LaoCai = &City{
		ID:   "laocai",
		Name: "Lào Cai",
		Lat:  22.3333,
		Lon:  103.9,
	}
	LongAn = &City{
		ID:   "longan",
		Name: "Long An",
		Lat:  10.5333,
		Lon:  106.4167,
	}
	NamDinh = &City{
		ID:   "namdinh",
		Name: "Nam Định",
		Lat:  20.4167,
		Lon:  106.1667,
	}
	NgheAn = &City{
		ID:   "nghean",
		Name: "Nghệ An",
		Lat:  19.5,
		Lon:  105.6667,
	}
	NinhBinh = &City{
		ID:   "ninhbinh",
		Name: "Ninh Bình",
		Lat:  20.25,
		Lon:  105.9667,
	}
	NinhThuan = &City{
		ID:   "ninhthuan",
		Name: "Ninh Thuận",
		Lat:  11.75,
		Lon:  108.25,
	}
	PhuTho = &City{
		ID:   "phutho",
		Name: "Phú Thọ",
		Lat:  21.3333,
		Lon:  105.0,
	}
	PhuYen = &City{
		ID:   "phuyen",
		Name: "Phú Yên",
		Lat:  13.0833,
		Lon:  109.3,
	}
	QuangBinh = &City{
		ID:   "quangbinh",
		Name: "Quảng Bình",
		Lat:  17.5,
		Lon:  106.25,
	}
	QuangNam = &City{
		ID:   "quangnam",
		Name: "Quảng Nam",
		Lat:  15.5833,
		Lon:  108.0,
	}
	QuangNgai = &City{
		ID:   "quangngai",
		Name: "Quảng Ngãi",
		Lat:  15.0,
		Lon:  108.75,
	}
	QuangNinh = &City{
		ID:   "quangninh",
		Name: "Quảng Ninh",
		Lat:  21.0,
		Lon:  107.0,
	}
	QuangTri = &City{
		ID:   "quangtri",
		Name: "Quảng Trị",
		Lat:  16.75,
		Lon:  107.0,
	}
	SocTrang = &City{
		ID:   "soctrang",
		Name: "Sóc Trăng",
		Lat:  9.6,
		Lon:  105.9667,
	}
	SonLa = &City{
		ID:   "sonla",
		Name: "Sơn La",
		Lat:  21.3333,
		Lon:  103.9,
	}
	TayNinh = &City{
		ID:   "tayninh",
		Name: "Tây Ninh",
		Lat:  11.3333,
		Lon:  106.1,
	}
	ThaiBinh = &City{
		ID:         "thaibinh",
		Name:       "Thái Bình",
		Lat:        20.4167,
		Lon:        106.3333,
		Deprecated: true,
	}
	ThaiNguyen = &City{
		ID:   "thainguyen",
		Name: "Thái Nguyên",
		Lat:  21.6,
		Lon:  105.85,
	}
	ThanhHoa = &City{
		ID:   "thanhhoa",
		Name: "Thanh Hóa",
		Lat:  19.8,
		Lon:  105.8,
	}
	ThuaThienHue = &City{
		ID:   "thuathienhue",
		Name: "Thừa Thiên Huế",
		Lat:  16.4667,
		Lon:  107.6,
	}
	TienGiang = &City{
		ID:   "tiengiang",
		Name: "Tiền Giang",
		Lat:  10.4167,
		Lon:  106.25,
	}
	TraVinh = &City{
		ID:   "travinh",
		Name: "Trà Vinh",
		Lat:  9.75,
		Lon:  106.25,
	}
	TuyenQuang = &City{
		ID:   "tuyenquang",
		Name: "Tuyên Quang",
		Lat:  22.0,
		Lon:  105.0,
	}
	VinhLong = &City{
		ID:   "vinhlong",
		Name: "Vĩnh Long",
		Lat:  10.25,
		Lon:  105.9667,
	}
	VinhPhuc = &City{
		ID:   "vinhphuc",
		Name: "Vĩnh Phúc",
		Lat:  21.3,
		Lon:  105.6,
	}
	YenBai = &City{
		ID:   "yenbai",
		Name: "Yên Bái",
		Lat:  21.7,
		Lon:  104.9,
	}

	FullCities = []*City{
		Hanoi,
		HoChiMinh,
		DaNang,
		HaiPhong,
		CanTho,
		AnGiang,
		BaRiaVungTau,
		BacGiang,
		BacKan,
		BacLieu,
		BacNinh,
		BenTre,
		BinhDinh,
		BinhDuong,
		BinhPhuoc,
		BinhThuan,
		CaMau,
		CaoBang,
		DakLak,
		DakNong,
		DienBien,
		DongNai,
		DongThap,
		GiaLai,
		HaGiang,
		HaNam,
		HaTinh,
		HaiDuong,
		HauGiang,
		HoaBinh,
		HungYen,
		KhanhHoa,
		KienGiang,
		KonTum,
		LaiChau,
		LamDong,
		LangSon,
		LaoCai,
		LongAn,
		NamDinh,
		NgheAn,
		NinhBinh,
		NinhThuan,
		PhuTho,
		PhuYen,
		QuangBinh,
		QuangNam,
		QuangNgai,
		QuangNinh,
		QuangTri,
		SocTrang,
		SonLa,
		TayNinh,
		ThaiBinh,
		ThaiNguyen,
		ThanhHoa,
		ThuaThienHue,
		TienGiang,
		TraVinh,
		TuyenQuang,
		VinhLong,
		VinhPhuc,
		YenBai,
	}

	NewCitiesAfterChange = []*City{}
	AllCitiesMap         = map[string]*City{}
)

func init() {
	for _, city := range FullCities {
		if !city.Deprecated {
			NewCitiesAfterChange = append(NewCitiesAfterChange, city)
		}
		AllCitiesMap[city.ID] = city
	}
}
