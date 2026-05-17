#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub → OSS 自动同步脚本
功能：将 GitHub 中的数据同步到 OSS
配置：从环境变量或配置文件读取敏感信息
"""

import requests
import oss2
import json
import sys
import os
from datetime import datetime

# ===== 配置 =====
# 从环境变量读取（推荐）
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
OSS_ACCESS_KEY_ID = os.environ.get('OSS_ACCESS_KEY_ID', '')
OSS_ACCESS_KEY_SECRET = os.environ.get('OSS_ACCESS_KEY_SECRET', '')

# 如果环境变量没有，尝试从配置文件读取
if not all([GITHUB_TOKEN, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET]):
    config_path = os.path.join(os.path.dirname(__file__), 'sync_config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
            GITHUB_TOKEN = config.get('github_token', '')
            OSS_ACCESS_KEY_ID = config.get('oss_access_key_id', '')
            OSS_ACCESS_KEY_SECRET = config.get('oss_access_key_secret', '')

# GitHub 配置
GITHUB_REPO = 'carvalauto/carvalauto.github.io'
GITHUB_API = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents'

# OSS 配置
OSS_BUCKET_NAME = 'carvalauto-products'
OSS_ENDPOINT = 'https://oss-cn-hangzhou.aliyuncs.com'

# 要同步的文件列表
FILES_TO_SYNC = ['products.json', 'inquiries.json']

# ===== 函数 =====

def decode_github_content(content_base64):
    """解码 GitHub Base64 内容"""
    import base64
    try:
        return base64.b64decode(content_base64).decode('utf-8')
    except Exception as e:
        print(f"❌ 解码失败: {e}")
        return None

def download_from_github(filename):
    """从 GitHub 下载文件"""
    url = f"{GITHUB_API}/{filename}"
    headers = {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(f"❌ GitHub 下载失败: {filename}, 状态码: {response.status_code}")
            return None
        
        data = response.json()
        content = decode_github_content(data.get('content', ''))
        
        if content:
            print(f"✅ 从 GitHub 下载成功: {filename} ({len(content)} bytes)")
            return content
        else:
            print(f"❌ GitHub 内容为空: {filename}")
            return None
            
    except Exception as e:
        print(f"❌ GitHub 下载异常: {filename}, 错误: {e}")
        return None

def upload_to_oss(filename, content):
    """上传文件到 OSS"""
    try:
        auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)
        
        # 上传文件
        bucket.put_object(filename, content)
        print(f"✅ 上传到 OSS 成功: {filename} ({len(content)} bytes)")
        return True
        
    except Exception as e:
        print(f"❌ OSS 上传失败: {filename}, 错误: {e}")
        return False

def update_version_json():
    """更新 version.json"""
    try:
        version_data = {
            "version": int(datetime.now().timestamp() * 1000),
            "timestamp": datetime.now().isoformat(),
            "source": "github_sync",
            "files": FILES_TO_SYNC
        }
        
        content = json.dumps(version_data, indent=2, ensure_ascii=False)
        
        auth = oss2.Auth(OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, OSS_ENDPOINT, OSS_BUCKET_NAME)
        
        bucket.put_object('version.json', content)
        print(f"✅ 更新 version.json 成功: {version_data['version']}")
        return True
        
    except Exception as e:
        print(f"❌ 更新 version.json 失败: {e}")
        return False

def sync_files():
    """同步所有文件"""
    print(f"\n{'='*50}")
    print(f"🚀 GitHub → OSS 同步开始")
    print(f"{'='*50}")
    
    # 检查配置
    if not all([GITHUB_TOKEN, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET]):
        print("❌ 缺少必要的配置！")
        print("请设置环境变量或创建 sync_config.json 文件")
        return False
    
    success_count = 0
    fail_count = 0
    
    for filename in FILES_TO_SYNC:
        print(f"\n📦 处理文件: {filename}")
        
        # 从 GitHub 下载
        content = download_from_github(filename)
        if not content:
            fail_count += 1
            continue
        
        # 上传到 OSS
        if upload_to_oss(filename, content):
            success_count += 1
        else:
            fail_count += 1
    
    # 更新 version.json
    if success_count > 0:
        print(f"\n🔄 更新版本控制...")
        update_version_json()
    
    # 输出结果
    print(f"\n{'='*50}")
    print(f"📊 同步结果:")
    print(f"✅ 成功: {success_count} 个文件")
    print(f"❌ 失败: {fail_count} 个文件")
    print(f"{'='*50}\n")
    
    return fail_count == 0

# ===== 主程序 =====
if __name__ == "__main__":
    try:
        success = sync_files()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ 程序异常: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

