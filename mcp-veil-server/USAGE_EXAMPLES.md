# Veil MCP Server - Usage Examples

This document provides real-world examples of how to use the Veil MCP Server with Claude Desktop.

## Basic Examples

### Example 1: Simple Web Search

**Your prompt:**
```
Search for "climate change solutions" and show me the top results
```

**What happens:**
1. Claude uses the `web-search` tool
2. DuckDuckGo searches for the query
3. Results are deidentified (any PII in snippets is masked)
4. Claude shows you 5 clean results with titles, URLs, and summaries

**Sample response:**
```
I've searched for "climate change solutions" and found these results:

1. Climate Solutions - United Nations
   URL: https://www.un.org/...
   Summary: Comprehensive overview of global climate solutions including <REDACTED> initiatives...

2. Top 10 Climate Change Solutions
   URL: https://example.com/...
   Summary: Renewable energy, carbon capture, and sustainable practices...
```

---

### Example 2: Scrape and Summarize a Specific Article

**Your prompt:**
```
Can you read this article and summarize the key points?
https://en.wikipedia.org/wiki/Renewable_energy
```

**What happens:**
1. Claude uses the `scrape-url` tool
2. The page is fetched and HTML is parsed
3. Main content is extracted and converted to Markdown
4. Content is deidentified
5. Claude reads and summarizes it for you

**Sample response:**
```
I've read the article on renewable energy. Here are the key points:

- Renewable energy comes from natural sources that replenish themselves
- Main types include solar, wind, hydroelectric, and geothermal
- Benefits include reduced carbon emissions and energy independence
- Challenges include storage, intermittency, and initial costs
...
```

---

### Example 3: Research Mode (Search + Scrape)

**Your prompt:**
```
Find and read an article about quantum computing, then explain it to me like I'm 10
```

**What happens:**
1. Claude uses the `search-and-scrape` tool
2. Searches for "quantum computing"
3. Automatically scrapes the top result
4. Deidentifies the content
5. Claude reads it and explains in simple terms

**Sample response:**
```
I found a great article on quantum computing! Let me explain it simply:

Imagine your computer is really fast at checking one answer at a time, like going through doors one by one. A quantum computer can check many doors at the same time! This makes it super powerful for certain types of problems...
```

---

## Advanced Examples

### Example 4: Competitive Research

**Your prompt:**
```
Search for information about "AI startups 2024" and identify common themes
```

**What happens:**
- Searches and deidentifies results
- Claude analyzes patterns across multiple sources
- Identifies trends without exposing sensitive company data

**Use case:** Market research, competitor analysis, trend identification

---

### Example 5: Technical Documentation Research

**Your prompt:**
```
Find documentation on React Server Components and create a quick reference guide
```

**What happens:**
- Searches for relevant documentation
- Scrapes the top result (likely from React docs)
- Deidentifies any examples with user data
- Claude creates a clean reference guide

**Use case:** Learning new technologies, creating internal documentation

---

### Example 6: News Aggregation

**Your prompt:**
```
Search for "AI regulations 2024" and summarize the latest developments from different countries
```

**What happens:**
- Searches for recent news
- Deidentifies any mentioned officials' personal info
- Claude synthesizes information from multiple sources
- Provides a comprehensive summary

**Use case:** Staying updated on regulations, policy tracking

---

### Example 7: Academic Research

**Your prompt:**
```
Find recent research papers on "neural network optimization" and highlight the main approaches
```

**What happens:**
- Searches for research papers
- Finds publicly available papers or abstracts
- Deidentifies author information if needed
- Claude summarizes methodologies

**Use case:** Literature review, research assistance

---

## Professional Use Cases

### Use Case 1: Legal Research

**Prompt:**
```
Search for "GDPR compliance checklist" and create a summary of requirements
```

**Benefits:**
- ✅ Deidentifies any company-specific examples
- ✅ Protects client information in examples
- ✅ Safe to use in client discussions

---

### Use Case 2: Healthcare Information

**Prompt:**
```
Find information about "diabetes management guidelines" and summarize best practices
```

**Benefits:**
- ✅ Patient information in case studies is deidentified
- ✅ Personal health data is masked
- ✅ HIPAA-compliant content extraction

---

### Use Case 3: Financial Analysis

**Prompt:**
```
Search for "2024 market outlook" and summarize analyst predictions
```

**Benefits:**
- ✅ Personal financial information is protected
- ✅ Account numbers and sensitive data are masked
- ✅ Safe for corporate research

---

## Creative Examples

### Example 8: Content Ideas

**Your prompt:**
```
Search for trending topics in "sustainable fashion" and suggest blog post ideas
```

**What Claude does:**
1. Searches for current trends
2. Analyzes search results
3. Generates original content ideas based on trends
4. All without exposing PII from fashion blogs

---

### Example 9: Recipe Research

**Your prompt:**
```
Find a recipe for "vegan chocolate cake" and adapt it to use less sugar
```

**What Claude does:**
1. Searches for recipes
2. Scrapes a popular recipe
3. Deidentifies any blogger personal info
4. Adapts the recipe to your needs

---

### Example 10: Travel Planning

**Your prompt:**
```
Search for "best hiking trails in Colorado" and create a 3-day itinerary
```

**What Claude does:**
1. Finds trail information
2. Scrapes detailed descriptions
3. Removes any personal reviews with PII
4. Creates custom itinerary

---

## Comparison: With vs Without Veil

### Without Veil (Standard Web Search)

**Risks:**
- Personal information in examples might be learned by Claude
- Company-specific data could be exposed
- Email addresses, phone numbers in search results visible
- Privacy concerns when processing sensitive topics

### With Veil MCP Server

**Protections:**
- ✅ All PII automatically masked before Claude sees it
- ✅ Company data protected with XML tags
- ✅ Contact information redacted
- ✅ Sensitive data flagged and secured

**Example of deidentified output:**
```
Before: "Contact John Smith at john@example.com for more info"
After:  "Contact <PERSON>John Smith</PERSON> at <EMAIL>john@example.com</EMAIL> for more info"
```

---

## Best Practices

### DO:

✅ **Use specific queries**
```
Good: "React Server Components tutorial 2024"
Bad:  "programming"
```

✅ **Combine with Claude's analysis**
```
"Search for X and compare the different approaches"
```

✅ **Iterate and refine**
```
"That's good, but can you find more recent sources?"
```

### DON'T:

❌ **Ask for personally identifiable information**
```
"Find the home address of [person]"
```

❌ **Scrape excessively**
```
"Scrape these 100 URLs for me"
```

❌ **Use for unauthorized access**
```
"Bypass the paywall on [site]"
```

---

## Tips for Better Results

### 1. Be Specific with Search Queries

**Instead of:**
```
"Find information about dogs"
```

**Try:**
```
"Find veterinary guidelines for dog nutrition and exercise"
```

### 2. Direct Scraping for Known URLs

**Instead of:**
```
"Search for the React documentation and read it"
```

**Try:**
```
"Scrape https://react.dev/reference/react/Server and explain server components"
```

### 3. Use Search-and-Scrape for Discovery

**Perfect for:**
```
"Find and read the latest article on [topic]"
"Discover recent developments in [field]"
"Get me up to speed on [technology]"
```

---

## Privacy in Action

### Example: Job Posting Research

**Your prompt:**
```
Search for "software engineer job requirements" and list common skills
```

**Without Veil:**
- Job postings might include recruiter emails
- Company-specific salary info might be exposed
- Candidate examples with PII visible

**With Veil:**
- ✅ Recruiter emails masked: `<EMAIL>recruiter@company.com</EMAIL>`
- ✅ Salary info tagged: `<SALARY>$120,000</SALARY>`
- ✅ Candidate names protected: `<PERSON>John Doe</PERSON>`
- ✅ Claude still understands context but PII is marked

---

## Troubleshooting Examples

### "No results found"

**Try:**
```
Original: "qxz programming language"
Better:  "popular programming languages 2024"
```

### "Failed to scrape URL"

**Try a different site:**
```
Original: https://paywalled-site.com/article
Alternative: https://en.wikipedia.org/wiki/Same_Topic
```

### "Content seems incomplete"

**Use more specific instructions:**
```
"Scrape [URL] and focus on the technical specifications section"
```

---

## Automation Ideas

### Daily Briefing

**Setup a routine:**
```
"Search for news about [your industry] and summarize the top 3 stories"
```

### Learning Path

**Weekly learning:**
```
"Find and explain one advanced concept in [technology] I should learn this week"
```

### Trend Monitoring

**Competitive intelligence:**
```
"Search for recent developments in [competitor space] and identify emerging patterns"
```

---

## Summary

The Veil MCP Server enables:

🔍 **Safe Web Search** - Find information without exposing PII  
📄 **Private Content Extraction** - Scrape and read without data leaks  
🤖 **Intelligent Research** - Let Claude discover and analyze securely  
🔒 **Privacy by Default** - All content automatically deidentified  

**Ready to search safely? Start with a simple query and explore! 🚀**

