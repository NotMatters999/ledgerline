fn main() {
    let search = "test";
    let pattern = format!("%{}%", search);
    println!("{} {}", pattern, pattern);
}
