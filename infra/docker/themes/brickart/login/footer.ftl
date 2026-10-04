<#macro content>
<#-- Rendered at the bottom of every login page. brickart.css lifts this out of the card
     (position: fixed) and uses it as the decorative panel on the left of the screen. -->
<aside class="brick-hero<#if pageId?? && pageId == 'register'> brick-hero--dark</#if>" aria-hidden="true">
  <#if pageId?? && pageId == 'register'>
    <div class="brick-hero__grid">
      <img src="${url.resourcesPath}/img/mosaic-portrait.png" alt="">
      <img src="${url.resourcesPath}/img/mosaic-daft.png" alt="">
      <img src="${url.resourcesPath}/img/mosaic-daft32.png" alt="">
      <img src="${url.resourcesPath}/img/mosaic-daft16.png" alt="">
    </div>
  <#else>
    <div class="brick-hero__frame"><div class="brick-hero__mat">
      <img src="${url.resourcesPath}/img/mosaic-portrait.png" alt="">
    </div></div>
    <p class="brick-hero__tag">Your photo. <em>In bricks.</em></p>
  </#if>
</aside>
</#macro>
