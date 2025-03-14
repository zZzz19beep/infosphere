import os
from typing import Optional
import requests
import json
from app.config import settings

class AIService:
    """Service for AI-powered article summarization"""
    
    def __init__(self, api_key: Optional[str] = None):
        # Initialize API settings
        self.api_key = api_key
        
        # DeepSeek API settings
        self.deepseek_api_url = settings.DEEPSEEK_API_URL
        self.deepseek_api_token = settings.DEEPSEEK_API_TOKEN
        self.deepseek_api_model = settings.DEEPSEEK_API_MODEL
        
        # Sankuai API settings (for backward compatibility)
        self.sankuai_api_url = settings.SANKUAI_API_URL
        self.sankuai_api_token = settings.SANKUAI_API_TOKEN
        self.sankuai_api_model = settings.SANKUAI_API_MODEL
        
        # OpenAI API settings (for backward compatibility)
        self.openai_api_url = "https://api.openai.com/v1/chat/completions"
    
    def summarize_article(self, content: str) -> str:
        """
        Summarize an article using AI API
        """
        # Try DeepSeek API first
        try:
            return self._summarize_with_deepseek(content)
        except Exception as e:
            print(f"Error with DeepSeek API: {str(e)}, falling back to Sankuai API")
            
        # Fallback to Sankuai API
        try:
            return self._summarize_with_sankuai(content)
        except Exception as e:
            print(f"Error with Sankuai API: {str(e)}, falling back to OpenAI API")
        
        # Fallback to OpenAI if specified
        if self.api_key:
            try:
                return self._summarize_with_openai(content)
            except Exception as e:
                print(f"Error with OpenAI API: {str(e)}, falling back to simple summary")
        
        # Use simple summary if no API is available
        return self._simple_summary(content)
        
    def _summarize_with_deepseek(self, content: str) -> str:
        """
        Summarize an article using DeepSeek API
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.deepseek_api_token}"
            }
            
            # Prepare the prompt
            prompt = f"""
            请用2-3句话总结以下markdown文章，重点关注主要内容和关键点：
            
            {content}
            """
            
            data = {
                "model": self.deepseek_api_model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that summarizes articles concisely."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False
            }
            
            response = requests.post(
                self.deepseek_api_url,
                headers=headers,
                data=json.dumps(data),
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                summary = result["choices"][0]["message"]["content"].strip()
                return summary
            else:
                print(f"Error from DeepSeek API: {response.status_code}, {response.text}")
                raise Exception(f"DeepSeek API error: {response.status_code}")
                
        except Exception as e:
            print(f"Error calling DeepSeek API: {str(e)}")
            raise e
    
    def _summarize_with_sankuai(self, content: str) -> str:
        """
        Summarize an article using Sankuai API with streaming response
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.sankuai_api_token}"
            }
            
            # Prepare the prompt
            prompt = f"""
            请用2-3句话总结以下markdown文章，重点关注主要内容和关键点：
            
            {content}
            """
            
            data = {
                "model": self.sankuai_api_model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "stream": True
            }
            
            try:
                response = requests.post(
                    self.sankuai_api_url,
                    headers=headers,
                    data=json.dumps(data),
                    stream=True,
                    timeout=30
                )
                
                if response.status_code == 200:
                    # Process streaming response
                    summary = ""
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        # Convert bytes to string and remove 'data: ' prefix
                        line_str = line.decode('utf-8')
                        if line_str.startswith('data: '):
                            line_str = line_str[6:]
                        
                        # Check for end of stream
                        if line_str == '[DONE]':
                            break
                        
                        try:
                            # Parse JSON and extract content
                            chunk = json.loads(line_str)
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    summary += delta['content']
                        except json.JSONDecodeError:
                            print(f"Error parsing JSON: {line_str}")
                    
                    if summary:
                        return summary.strip()
                    else:
                        print("No content received from Sankuai API, using fallback")
                        raise Exception("No content received from Sankuai API")
                else:
                    print(f"Error from Sankuai API: {response.status_code}, {response.text}")
                    raise Exception(f"Sankuai API error: {response.status_code}")
            except requests.exceptions.RequestException as req_err:
                print(f"Request error with Sankuai API: {str(req_err)}")
                raise req_err
                
        except Exception as e:
            print(f"Error calling Sankuai API: {str(e)}")
            raise e
    
    def _summarize_with_openai(self, content: str) -> str:
        """
        Summarize an article using OpenAI API (legacy method)
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            # Prepare the prompt for the OpenAI API
            prompt = f"""
            Please summarize the following markdown article in 2-3 sentences, 
            focusing on the key points and main ideas:
            
            {content}
            """
            
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that summarizes articles concisely."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 150
            }
            
            response = requests.post(
                self.openai_api_url,
                headers=headers,
                data=json.dumps(data),
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                summary = result["choices"][0]["message"]["content"].strip()
                return summary
            else:
                print(f"Error from OpenAI API: {response.status_code}, {response.text}")
                raise Exception(f"OpenAI API error: {response.status_code}")
                
        except Exception as e:
            print(f"Error calling OpenAI API: {str(e)}")
            raise e
    
    def _simple_summary(self, content: str) -> str:
        """Fallback method for summarization when API is not available"""
        # Extract the first paragraph that's not a heading
        lines = content.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                return f"This is an auto-generated summary: {line[:200]}..."
        
        return "No summary available."
