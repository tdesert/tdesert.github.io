$(document).ready(function() {

    // Algolia setup
    var conjunctiveFacets = [];
    var disjunctiveFacets = [];
    Config.Algolia.Facets.forEach(function(facet) {
        if (facet.type == 'conjunctive') conjunctiveFacets.push(facet.name);
        if (['disjunctive', 'slider', 'rating'].includes(facet.type)) disjunctiveFacets.push(facet.name);
    });

    var algolia = algoliasearch(Config.Algolia.ApplicationId, Config.Algolia.APIKey);
    var algoliaHelper = algoliasearchHelper(algolia, Config.Algolia.IndexName, {
        hitsPerPage: Config.Algolia.HitsPerPage,
        maxValuesPerFacet: 8,
        facets: conjunctiveFacets,
        disjunctiveFacets: disjunctiveFacets,
        index: Config.Algolia.IndexName
    });

    // DOM Elements
    var $searchInput = $('#search-input');
    var $stats = $('#stats');
    var $hits = $('#hits');
    var $facets = $('#facets');
    var $sortBySelect = $('#sort-by-select');
    var $refinementTags = $('#refinement-tags');

    // Templates
    var statsTemplate = Hogan.compile($('#stats-template').text());
    var hitsTemplate = Hogan.compile($('#hits-template').text());
    var noResultsTemplate = Hogan.compile($('#no-results-template').text());
    var facetTemplate = Hogan.compile($('#facet-template').text());
    var sliderTemplate = Hogan.compile($('#slider-template').text());
    var ratingTemplate = Hogan.compile($('#rating-template').text());
    var refinementTagTemplate = Hogan.compile($('#refinement-tag-template').text());



    // SEARCH

    $searchInput.on('input propertychange', function(e) {
        var query = e.currentTarget.value;
        algoliaHelper.setQuery(query).search();
    });

    // Search errors
    algoliaHelper.on('error', function(error) {
        console.log(error);
    });

    // Search results
    algoliaHelper.on('result', function(content, state) {
        if (algoliaHelper.getPage() > 0) {
            renderHits(content, true);
        } else {
            renderStats(content);
            renderHits(content);
            renderFacets(content, state);
            bindFacets(state);
        }

    });


    /// Events binding

    $sortBySelect.on('change', function(e) {
        e.preventDefault();
        algoliaHelper.setIndex(Config.Algolia.IndexName + $(this).val()).search();
    });

    $(document).on('click', '.facet-toggle', function(e) {
        e.preventDefault()
        algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
    });

    $(document).on('click', '.facet-clear', function(e) {
        e.preventDefault()
        algoliaHelper.clearRefinements($(this).data('facet')).search();
    });

    $(document).on('click', '.refinement-tag', function(e) {
        e.preventDefault()
        if ($(this).data('isNumeric') === true) {
            algoliaHelper.removeNumericRefinement($(this).data('facet')).search();
        } else {
            algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
        }
    });

    $(document).on('click', '#hits-next-page', function(e) {
        e.preventDefault();
        $(this).remove()
        algoliaHelper.setPage(algoliaHelper.getPage() + 1).search();
    });

    $('.brand').on('click', function(e) {
        algoliaHelper.clearRefinements().search();
    });

    $(document).on('click', '.clear-query-string', function(e) {
        e.preventDefault();
        $searchInput.val('').focus();
        algoliaHelper.setQuery('').clearRefinements().search();
    });


    ///
    /// Rendering functions
    ///

    // Search results stats (number of results)
    function renderStats(content) {
        $stats.html(statsTemplate.render({
            nbHits: content.nbHits,
            nbHits_plural: content.nbHits !== 1
        }));
    }

    // Render search results
    function renderHits(content, append) {

        if (content.nbHits == 0) {
            // Handle no results display
            $hits.html(noResultsTemplate.render({
                queryString: content.query
            }))
            return
        }

        content['hasNextPage'] = content.page < content.nbPages;
        var maxRatingValue = (content.getFacetByName('rating') && content.getFacetByName('rating').stats.max) || 0
        content.hits.forEach(function(hit) {
            ratingStars = [];
            for (var i = 0; i < maxRatingValue; i++) {
                ratingStars.push({
                    enabled: i < hit.rating
                });
            }
            hit['ratingStars'] = ratingStars;
        })


        if (typeof(append) != 'undefined') {
            $hits.append(hitsTemplate.render(content));
        } else {
            $hits.html(hitsTemplate.render(content));
        }
    }

    // Render facets UI
    function renderFacets(content, state) {

        var facetsHtml = ''
        var refinementTags = []
        Config.Algolia.Facets.forEach(function(facet, idx) {
            var result = content.getFacetByName(facet.name);
            if (!result) return;

            // Render toggleable facets lists for conjunctive and disjunctive facets
            if (facet.type == 'conjunctive' || facet.type == 'disjunctive') {
                var refinedValues = (facet.type == 'conjunctive') ? state.getConjunctiveRefinements(facet.name) : state.getDisjunctiveRefinements(facet.name)

                var facetData = {
                    facet: facet.name,
                    title: facet.displayName,
                    values: content.getFacetValues(facet.name, {
                        sortBy: ['count:desc']
                    }),
                    isDisjunctive: facet.type == 'disjunctive',
                    hasRefinements: refinedValues.length > 0
                };
                facetsHtml += facetTemplate.render(facetData);

                // Refinement tags
                var tags = refinedValues.map(function(value) {
                    return {
                        value: value,
                        title: value,
                        facet: facet.name,
                        isNumeric: false
                    }
                });
                refinementTags = refinementTags.concat(tags);
            }

            // Sliders
            else if (facet.type == 'slider') {
                var min = Math.floor(result.stats.min)
                var max = Math.floor(result.stats.max)
                var lowerRefinement = state.getNumericRefinement(facet.name, '>=')
                var upperRefinement = state.getNumericRefinement(facet.name, '<=')
                var minValue = lowerRefinement || min;
                var maxValue = upperRefinement || max;
                var refinedValues = (lowerRefinement || []) + (upperRefinement || [])

                var sliderData = {
                    facet: facet.name,
                    title: facet.displayName,
                    value: '[' + minValue + ', ' + maxValue + ']',
                    min: min,
                    max: max,
                    step: 5,
                    hasRefinements: refinedValues.length > 0
                };

                facetsHtml += sliderTemplate.render(sliderData);

                // Refinement tags
                var tag = formatRangeRefinementTag(state, facet.name, min, max);
                if (tag !== null) {
                    refinementTags.push(tag);
                }
            }

            // Ratings
            else if (facet.type == 'rating') {
                var currentRefinement = state.getNumericRefinement(facet.name, '>=') || []
                var values = content.getFacetValues(facet.name)
                    .map(function(object) {
                        return {
                            value: object.name,
                            isRefined: currentRefinement.includes(Number(object.name))
                        }
                    })
                    .sort(function(a, b) {
                        if (a.value > b.value) return 1;
                        else if (a.value < b.value) return -1;
                        return 0;
                    });
                var ratingData = {
                    title: facet.displayName,
                    facet: facet.name,
                    values: values,
                    hasRefinements: currentRefinement.length > 0
                };
                facetsHtml += ratingTemplate.render(ratingData);

                // Refinement tags
                var facetValue = state.getNumericRefinement(facet.name, '>=') || null
                if (facetValue !== null) {
                    var stars = ''
                    for (var i = 0; i < facetValue; i++) {
                        stars += '<span class="glyphicon glyphicon-star"></span>';
                    }
                    refinementTags.push({
                        value: facetValue,
                        title: 'Min rating: ' + stars,
                        facet: facet.name,
                        isNumeric: true
                    });
                }
            }
        });

        $facets.html(facetsHtml);

        var refinementTagsHtml = '';
        refinementTags.forEach(function(tag) {
            refinementTagsHtml += refinementTagTemplate.render(tag);
        });
        $refinementTags.html(refinementTagsHtml);
    }

    // Bind facet components
    function bindFacets(state) {

        Config.Algolia.Facets.forEach(function(facet, idx) {
            if (facet.type == 'slider') {
                var $slider = $facets.find('#slider-' + facet.name);
                if (!$slider.length) {
                    return
                }

                // Slider facets Binding
                $slider.slider({
                    tooltip_split: true,
                    handle: 'custom',
                    formatter: function(v) {
                        return '$' + v
                    }
                }).on('slideStop', function(e) {
                    var sliderData = $(this).data();
                    var inputValues = $(this).val().split(',')
                    var userValues = {
                        min: Number(inputValues[0]),
                        max: Number(inputValues[1])
                    };
                    var lowerRefinement = state.getNumericRefinement(facet.name, '>=');

                    // Apply numeric refinement for lower values
                    lowerRefinement = lowerRefinement && lowerRefinement[0] || sliderData.sliderMin;
                    if (userValues.min !== lowerRefinement) {
                        // Remove axisting refinement
                        algoliaHelper.removeNumericRefinement(facet.name, '>=');
                        if (userValues.min != sliderData.sliderMin) {
                            // Apply user defined refinement if any
                            algoliaHelper.addNumericRefinement(facet.name, '>=', userValues.min);
                        }
                        algoliaHelper.search()
                    }
                    var upperRefinement = state.getNumericRefinement(facet.name, '<=');
                    upperRefinement = upperRefinement && upperRefinement[0] || sliderData.sliderMax;
                    if (userValues.max !== upperRefinement) {
                        // Remove axisting refinement
                        algoliaHelper.removeNumericRefinement(facet.name, '<=');
                        if (userValues.max != sliderData.sliderMax) {
                            // Apply user defined refinement if any
                            algoliaHelper.addNumericRefinement(facet.name, '<=', userValues.max);
                        }
                        algoliaHelper.search();
                    }
                });
            }

            // Rating facets binding
            else if (facet.type == 'rating') {
                var $rating = $facets.find('#rating-' + facet.name);
                $rating.barrating({
                    theme: 'bootstrap-stars',
                    initialRating: null,
                    allowEmpty: null,
                    deselectable: true,
                });
                $rating.on('change', function() {
                    var newValue = $(this).val()
                    algoliaHelper.removeNumericRefinement(facet.name, '>=');
                    if (newValue.length > 0) {
                        algoliaHelper.addNumericRefinement(facet.name, '>=', newValue);
                    }
                    algoliaHelper.search();
                });
            }
        });
    }

    // Perform initial search
    algoliaHelper.search();

});



/// Helpers 

function formatRangeRefinementTag(state, facetName, lowerValue, upperValue) {
    var min = state.getNumericRefinement(facetName, '>=')
    var max = state.getNumericRefinement(facetName, '<=')
    var minTagValue = (min > lowerValue) ? (min || '') : '';
    var maxTagValue = (max < upperValue) ? (max || '') : '';
    var title = '';
    if (minTagValue.length > 0) {
        title += 'min: €' + minTagValue;
    }
    if (minTagValue.length > 0 && maxTagValue.length > 0) {
        title += ' - ';
    }
    if (maxTagValue.length > 0) {
        title += 'max: €' + maxTagValue;
    }
    if (title.length == 0) return null;

    return {
        title: title,
        value: '',
        facet: facetName,
        isNumeric: true
    };
}