# 🎬 DhakaFlix MovieBox - GitHub Pages Website

একটি সম্পূর্ণ রেডি-টু-গো (Ready-to-go) স্ট্যাটিক মুভি ওয়েবসাইট যা সরাসরি **GitHub Pages** এ ফ্রিতে হোস্ট করা যায়। এতে ঢাকাফ্লিক্সের **৭,৯২০+ টিরও বেশি মুভি**, পোস্টার, ক্যাটাগরি, সার্চ এবং স্ট্রিমিং লিঙ্ক অন্তর্ভুক্ত রয়েছে।

---

## 🚀 গিটহাবে রান করার নিয়ম (How to Run on GitHub):

### ধাপ ১: GitHub এ নতুন Repository তৈরি করুন
1. [github.com](https://github.com/) এ গিয়ে লগইন করুন।
2. **New Repository** তে ক্লিক করুন (যেকোনো নাম দিন, যেমন: `dhakaflix-movies`).
3. Repository টি **Public** রাখুন এবং Create এ ক্লিক করুন।

### ধাপ ২: এই ফোল্ডারের ফাইলগুলো আপলোড করুন
1. এই ফোল্ডারের (`DhakaFlix-GitHub-Website`) ফাইলগুলো:
   - `index.html`
   - `movies.json`
2. আপনার GitHub Repository তে **Add file > Upload files** দিয়ে ড্র্যাগ & ড্রপ করে **Commit changes** এ ক্লিক করুন।

### ধাপ ৩: GitHub Pages অন করুন (Website Live করুন)
1. Repository এর **Settings** ট্যাবে যান।
2. বাম পাশের মেনু থেকে **Pages** এ ক্লিক করুন।
3. **Branch** অপশনে `main` (বা `master`) সিলেক্ট করে **Save** বাটনে ক্লিক করুন।
4. ১ মিনিটের মধ্যে আপনার ফ্রি লাইভ ওয়েবসাইট লিঙ্ক তৈরি হয়ে যাবে:
   ```text
   https://<your-username>.github.io/<repo-name>/
   ```

---

## ⚡ লোকাল প্রিভিউ (কম্পিউটারে আগে চালিয়ে দেখার জন্য):
- **`preview.bat`** এ ডাবল-ক্লিক করলেই ব্রাউজারে `http://localhost:8000` চালু হবে।

---

## 🔄 নতুন মুভি ডেটা আপডেট করতে চাইলে:
- ফোল্ডারে থাকা **`update_data.py`** চালালে এটি ঢাকাফ্লিক্সের নতুন নতুন মুভিগুলো স্বয়ংক্রিয়ভাবে স্ক্যান করে `movies.json` ফাইলে আপডেট করে দেবে।
