// 总结接口仅在回忆日记配置，与主接口及辅助接口分开。
(() => {
    function fromPreset(p){const d=p.data||{};return {provider:d.provider||'newapi',url:d.apiUrl||d.url||'',key:d.apiKey||d.key||'',model:d.model||'',temperatureEnabled:d.temperatureEnabled===true,temperature:Number.isFinite(Number(d.temperature))?Number(d.temperature):.7};}
    function resolve(chat){const setting=window.JournalAutomation.state(chat).summaryApi||{};
        if(!['url','key','model'].some(k=>String(setting[k]||'').trim()))return {...db.apiSettings,...(typeof setting.temperatureEnabled==='boolean'?{temperatureEnabled:setting.temperatureEnabled,temperature:setting.temperature??.7}:{})};
        if(!['url','key','model'].every(k=>String(setting[k]||'').trim()))throw new Error('总结 API 地址、密钥、模型需填写完整，或全部留空使用主 API');
        return {...db.apiSettings,...setting,url:setting.url.trim().replace(/\/$/,''),key:setting.key.trim(),isSecondaryApi:false};
    }
    function options(config){return config.temperatureEnabled?{temperature:Number(config.temperature)}:{};}
    function fillPresets(select){select.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='选择已保存的 API 预设';select.append(none);(db.apiPresets||[]).forEach((p,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=p.name;select.append(option);});}
    function open(chat){
        const state=JournalAutomation.state(chat),archive=chat.activeArchiveId||null,overlay=document.createElement('div'),form=document.createElement('form');overlay.className='v18-glass-overlay';form.className='v18-glass-dialog journal-auto-settings';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');
        form.innerHTML='<h3>总结专用 API</h3><label>已保存预设<select name="preset"></select></label><label>服务商<select name="provider"><option value="newapi">OpenAI兼容</option><option value="deepseek">DeepSeek</option><option value="claude">Claude兼容</option><option value="gemini">Gemini</option></select></label><label>地址<input name="url" type="text" placeholder="API地址"></label><label>密钥<input name="key" type="password" autocomplete="off"></label><label>模型<input name="model" type="text"></label><label><input name="temperatureEnabled" type="checkbox">自定义温度 <output name="temperatureValue"></output></label><input name="temperature" type="range" min="0" max="2" step="0.1"><p>供当前聊天的手动、自动大小总结使用。地址、密钥和模型全部留空时使用主 API；不读取原副 API。</p><button type="submit">保存</button><button type="button" class="summary-api-clear">恢复主 API</button><button type="button" class="summary-api-cancel">取消</button>';
        const f=form.elements;fillPresets(f.preset);
        const fill=setting=>{f.provider.value=setting.provider||'newapi';f.url.value=setting.url||'';f.key.value=setting.key||'';f.model.value=setting.model||'';f.temperatureEnabled.checked=setting.temperatureEnabled===true;f.temperature.value=setting.temperature??.7;update();};
        const update=()=>{f.temperatureValue.value=f.temperature.value;f.temperature.disabled=!f.temperatureEnabled.checked;};fill(state.summaryApi||{});f.temperature.oninput=update;f.temperatureEnabled.onchange=update;
        f.preset.onchange=()=>{if(f.preset.value!==''){const p=db.apiPresets[Number(f.preset.value)];if(p)fill(fromPreset(p));}};
        form.querySelector('.summary-api-clear').onclick=()=>fill({});form.querySelector('.summary-api-cancel').onclick=()=>overlay.remove();
        form.onsubmit=async e=>{e.preventDefault();if(JournalAutomation.state(chat)!==state||(chat.activeArchiveId||null)!==archive){showToast('存档已切换，请重新设置');return;}
            const next={provider:f.provider.value,url:f.url.value.trim(),key:f.key.value.trim(),model:f.model.value.trim(),temperatureEnabled:f.temperatureEnabled.checked,temperature:Number(f.temperature.value)};
            const count=['url','key','model'].filter(k=>next[k]).length;if(count>0&&count<3){showToast('请填写完整接口，或全部留空使用主 API');return;}
            if((typeof BLOCKED_API_DOMAINS!=='undefined'?BLOCKED_API_DOMAINS:[]).some(d=>next.url.includes(d))){showToast('该 API 站点不可使用');return;}
            const old=state.summaryApi;state.summaryApi=next;try{await saveData();overlay.remove();showToast('总结 API 已保存');}catch(error){state.summaryApi=old;showToast('总结 API 未保存成功');}
        };overlay.append(form);document.body.append(overlay);
    }
    function setupSecondary(){const select=document.getElementById('secondary-api-preset');if(!select)return;fillPresets(select);
        const enabled=document.getElementById('secondary-temperature-enabled'),slider=document.getElementById('secondary-temperature'),value=document.getElementById('secondary-temperature-value');const saved=db.apiSettings?.secondary||{};enabled.checked=saved.temperatureEnabled===true;slider.value=saved.temperature??.7;
        const update=()=>{value.textContent=slider.value;slider.disabled=!enabled.checked;};update();slider.oninput=update;enabled.onchange=update;
        select.onchange=()=>{if(select.value==='')return;const p=db.apiPresets?.[Number(select.value)];if(!p)return;const config=fromPreset(p);
            for(const key of ['provider','url','key'])document.getElementById('secondary-api-'+key).value=config[key];
            const model=document.getElementById('secondary-api-model'),option=document.createElement('option');option.value=config.model;option.textContent=config.model;model.replaceChildren(option);
            enabled.checked=config.temperatureEnabled;slider.value=config.temperature;update();
        };
    }
    window.SummaryApi={resolve,options,open,setupSecondary,fromPreset};
    window.addEventListener('api-presets-updated',()=>{const select=document.getElementById('secondary-api-preset');if(select)fillPresets(select);});
})();
