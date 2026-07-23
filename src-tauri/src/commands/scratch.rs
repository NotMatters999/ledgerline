use genpdf::fonts::{FontData, FontFamily};

pub fn check_genpdf_fonts() {
    let font_bytes = include_bytes!("../../../assets/fonts/LiberationSans-Regular.ttf").to_vec();
    let data = FontData::new(font_bytes, None).unwrap();
    let family = FontFamily {
        regular: data.clone(),
        bold: data.clone(),
        italic: data.clone(),
        bold_italic: data.clone(),
    };
}
